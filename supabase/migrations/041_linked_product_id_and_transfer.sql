-- =====================================================
-- Migration 041: linked_product_id + transferencia manual a venta
-- =====================================================
-- Permite vincular productos de producción (semi_finished/finished_good)
-- a un producto simple/combo de venta. La transferencia de inventario
-- desde el pool de producción al pool de venta es MANUAL y explícita,
-- vía el RPC transfer_production_to_sales().
-- =====================================================

-- ── 1. Columna linked_product_id en products (muchos→uno) ──────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS linked_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_linked ON products(linked_product_id);

-- Constraint: linked_product_id solo aplica a semi_finished/finished_good
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_linked_only_production;
ALTER TABLE products ADD CONSTRAINT products_linked_only_production
  CHECK (
    linked_product_id IS NULL
    OR type IN ('semi_finished', 'finished_good')
  );

COMMENT ON COLUMN products.linked_product_id IS
'Para semi_finished/finished_good: apunta al producto simple/combo de venta al que se puede transferir manualmente el inventario producido vía RPC transfer_production_to_sales. La transferencia NO es automática al completar una OP.';

-- ── 2. Reemplazar complete_production_order con modo ajuste opcional ──
-- (NO incluye auto-release; la liberación a venta es manual y separada)
DROP FUNCTION IF EXISTS complete_production_order(UUID, NUMERIC, UUID);

CREATE OR REPLACE FUNCTION complete_production_order(
  p_order_id      UUID,
  p_qty_produced  NUMERIC,
  p_operator_id   UUID DEFAULT NULL,
  p_mode          TEXT DEFAULT 'in',       -- 'in' (suma normal) | 'adjust' (fija stock objetivo)
  p_target_stock  NUMERIC DEFAULT NULL     -- requerido si p_mode='adjust'
)
RETURNS TABLE(
  success           BOOLEAN,
  message           TEXT,
  movements_created INT
) AS $$
DECLARE
  v_order          RECORD;
  v_product        RECORD;
  v_material       RECORD;
  v_qty_consume    NUMERIC;
  v_movement_count INT := 0;
  v_current_stock  NUMERIC;
  v_in_qty         NUMERIC;
BEGIN
  SELECT * INTO v_order FROM production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Orden no encontrada'::TEXT, 0; RETURN;
  END IF;

  IF v_order.status NOT IN ('in_progress', 'paused') THEN
    RETURN QUERY SELECT false,
      ('La orden debe estar in_progress o paused. Estado: ' || v_order.status)::TEXT, 0;
    RETURN;
  END IF;

  IF p_mode NOT IN ('in', 'adjust') THEN
    RETURN QUERY SELECT false, 'Modo inválido (in|adjust)'::TEXT, 0; RETURN;
  END IF;

  IF p_mode = 'adjust' AND p_target_stock IS NULL THEN
    RETURN QUERY SELECT false, 'Modo ajuste requiere p_target_stock'::TEXT, 0; RETURN;
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_order.product_id;

  -- 1) OUT de cada componente del BOM (en su pool propio)
  FOR v_material IN
    SELECT * FROM production_order_materials WHERE production_order_id = p_order_id
  LOOP
    v_qty_consume := ROUND(v_material.qty_required * (p_qty_produced / v_order.qty_planned), 4);

    IF v_qty_consume > 0 THEN
      INSERT INTO inventory_movements (
        movement_type, qty_signed, warehouse_id, product_id,
        user_id, ref_type, ref_id, notes
      ) VALUES (
        'OUT', -v_qty_consume, v_order.warehouse_id,
        v_material.component_product_id,
        COALESCE(p_operator_id, v_order.operator_id),
        'production_out', p_order_id,
        'Insumo consumido en ' || v_order.order_number || ' (' || v_product.name || ')'
      );
      v_movement_count := v_movement_count + 1;

      UPDATE production_order_materials
      SET qty_consumed = qty_consumed + v_qty_consume
      WHERE id = v_material.id;
    END IF;
  END LOOP;

  -- 2) Movimiento al pool del producto producido (IN normal o ajuste delta)
  IF p_mode = 'in' THEN
    v_in_qty := p_qty_produced;
  ELSE
    SELECT COALESCE(SUM(qty_signed), 0) INTO v_current_stock
    FROM inventory_movements
    WHERE product_id = v_order.product_id AND warehouse_id = v_order.warehouse_id;
    v_in_qty := p_target_stock - v_current_stock;  -- delta, puede ser negativo
  END IF;

  IF v_in_qty <> 0 THEN
    INSERT INTO inventory_movements (
      movement_type, qty_signed, warehouse_id, product_id,
      user_id, ref_type, ref_id, notes
    ) VALUES (
      CASE WHEN v_in_qty > 0 THEN 'IN' ELSE 'OUT' END,
      v_in_qty, v_order.warehouse_id, v_order.product_id,
      COALESCE(p_operator_id, v_order.operator_id),
      CASE WHEN p_mode = 'in' THEN 'production_in' ELSE 'production_adjust' END,
      p_order_id,
      CASE
        WHEN p_mode = 'in' THEN 'Producción completada: ' || v_order.order_number
        ELSE 'Ajuste de producción ' || v_order.order_number || ' a stock ' || p_target_stock
      END
    );
    v_movement_count := v_movement_count + 1;
  END IF;

  -- 3) Actualizar orden
  UPDATE production_orders
  SET status = 'completed',
      qty_produced = qty_produced + p_qty_produced,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT
    true,
    (v_order.order_number || ': ' || p_qty_produced || ' unidades · ' ||
     v_movement_count || ' movimientos')::TEXT,
    v_movement_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Nuevo RPC: transferencia manual de producción → producto vinculado ──
CREATE OR REPLACE FUNCTION transfer_production_to_sales(
  p_source_product_id UUID,         -- producto de producción (semi/finished)
  p_warehouse_id      UUID,
  p_qty               NUMERIC,
  p_operator_id       UUID DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL
)
RETURNS TABLE(
  success           BOOLEAN,
  message           TEXT,
  movements_created INT
) AS $$
DECLARE
  v_source     RECORD;
  v_target     RECORD;
  v_available  NUMERIC;
BEGIN
  -- Validar que el producto origen existe y es de producción con vínculo
  SELECT * INTO v_source FROM products WHERE id = p_source_product_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Producto origen no encontrado'::TEXT, 0; RETURN;
  END IF;

  IF v_source.type NOT IN ('semi_finished', 'finished_good') THEN
    RETURN QUERY SELECT false,
      'Solo se puede transferir desde semi_finished o finished_good'::TEXT, 0;
    RETURN;
  END IF;

  IF v_source.linked_product_id IS NULL THEN
    RETURN QUERY SELECT false,
      ('El producto ' || v_source.name || ' no tiene producto de venta vinculado')::TEXT, 0;
    RETURN;
  END IF;

  IF p_qty <= 0 THEN
    RETURN QUERY SELECT false, 'La cantidad debe ser mayor a 0'::TEXT, 0; RETURN;
  END IF;

  -- Validar stock disponible en el origen
  SELECT COALESCE(SUM(qty_signed), 0) INTO v_available
  FROM inventory_movements
  WHERE product_id = p_source_product_id AND warehouse_id = p_warehouse_id;

  IF v_available < p_qty THEN
    RETURN QUERY SELECT false,
      ('Stock insuficiente en ' || v_source.name || ': disponible ' || v_available ||
       ', solicitado ' || p_qty)::TEXT, 0;
    RETURN;
  END IF;

  -- Cargar el producto destino para nombrarlo en notas
  SELECT * INTO v_target FROM products WHERE id = v_source.linked_product_id;

  -- Movimiento 1: OUT en el pool de producción
  INSERT INTO inventory_movements (
    movement_type, qty_signed, warehouse_id, product_id,
    user_id, ref_type, ref_id, notes
  ) VALUES (
    'OUT', -p_qty, p_warehouse_id, p_source_product_id,
    p_operator_id, 'production_release', NULL,
    'Transferido a ' || v_target.name || ' (manual)' ||
      CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
           THEN ' · ' || p_notes ELSE '' END
  );

  -- Movimiento 2: IN en el pool del producto de venta
  INSERT INTO inventory_movements (
    movement_type, qty_signed, warehouse_id, product_id,
    user_id, ref_type, ref_id, notes
  ) VALUES (
    'IN', p_qty, p_warehouse_id, v_source.linked_product_id,
    p_operator_id, 'production_release', NULL,
    'Recibido desde ' || v_source.name || ' (manual)' ||
      CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
           THEN ' · ' || p_notes ELSE '' END
  );

  RETURN QUERY SELECT
    true,
    (p_qty || ' unidades transferidas de ' || v_source.name || ' a ' || v_target.name)::TEXT,
    2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Comentarios ────────────────────────────────────────────────
COMMENT ON FUNCTION complete_production_order IS
'Completa OP en su pool propio:
 1. OUT de insumos del BOM (production_out)
 2. IN del producto producido (production_in) o delta a stock objetivo (production_adjust)
NO transfiere automáticamente a producto vinculado. Para eso usar transfer_production_to_sales().';

COMMENT ON FUNCTION transfer_production_to_sales IS
'Transferencia manual: mueve qty del pool del producto de producción al pool del producto simple vinculado. Valida stock disponible. Crea 2 movimientos production_release con notas que mantienen la trazabilidad de origen.';
