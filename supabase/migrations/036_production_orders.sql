-- =====================================================
-- Migration 036: Módulo de Producción / Fabricación
-- =====================================================
-- production_orders:          Órdenes de fabricación
-- production_order_materials: Insumos planificados y consumidos reales
-- =====================================================

-- ── 1. Órdenes de producción ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number    TEXT UNIQUE NOT NULL,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  bom_id          UUID REFERENCES bom_headers(id) ON DELETE SET NULL,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  operator_id     UUID REFERENCES operators(id) ON DELETE SET NULL,
  qty_planned     NUMERIC(12, 4) NOT NULL,
  qty_produced    NUMERIC(12, 4) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  planned_date    DATE,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT production_orders_status_check
    CHECK (status IN ('draft', 'in_progress', 'paused', 'completed', 'cancelled')),
  CONSTRAINT production_orders_qty_positive
    CHECK (qty_planned > 0)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_product   ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_warehouse ON production_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_operator  ON production_orders(operator_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status    ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_date      ON production_orders(planned_date);

-- ── 2. Materiales por orden (planificado vs consumido real) ───────────────
CREATE TABLE IF NOT EXISTS production_order_materials (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id   UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  component_product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty_required          NUMERIC(12, 4) NOT NULL,   -- calculado del BOM × qty_planned
  qty_consumed          NUMERIC(12, 4) DEFAULT 0,  -- real consumido (puede diferir)
  notes                 TEXT,
  UNIQUE(production_order_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_materials_order     ON production_order_materials(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_materials_component ON production_order_materials(component_product_id);

-- ── 3. Función: generar número de orden de producción ────────────────────
CREATE OR REPLACE FUNCTION generate_production_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date   TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count  INT;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM production_orders
  WHERE DATE(created_at) = CURRENT_DATE;

  v_number := 'OP-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');

  -- Evitar colisión
  WHILE EXISTS (SELECT 1 FROM production_orders WHERE order_number = v_number) LOOP
    v_count := v_count + 1;
    v_number := 'OP-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');
  END LOOP;

  RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Función: iniciar producción ───────────────────────────────────────
-- Valida stock de insumos, crea materiales desde BOM si no existen,
-- cambia status a in_progress
CREATE OR REPLACE FUNCTION start_production_order(p_order_id UUID)
RETURNS TABLE(
  success   BOOLEAN,
  message   TEXT,
  warnings  TEXT[]
) AS $$
DECLARE
  v_order         RECORD;
  v_material      RECORD;
  v_warnings      TEXT[] := '{}';
  v_available     NUMERIC;
BEGIN
  -- Obtener orden
  SELECT * INTO v_order FROM production_orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Orden no encontrada'::TEXT, '{}'::TEXT[];
    RETURN;
  END IF;

  IF v_order.status != 'draft' THEN
    RETURN QUERY SELECT false,
      ('Solo órdenes en borrador pueden iniciarse. Estado actual: ' || v_order.status)::TEXT,
      '{}'::TEXT[];
    RETURN;
  END IF;

  -- Si no tiene materiales aún, poblarlos desde BOM
  IF NOT EXISTS (SELECT 1 FROM production_order_materials WHERE production_order_id = p_order_id) THEN
    IF v_order.bom_id IS NOT NULL THEN
      INSERT INTO production_order_materials (production_order_id, component_product_id, qty_required)
      SELECT
        p_order_id,
        bi.component_product_id,
        ROUND(bi.qty_required * bi.waste_factor * v_order.qty_planned, 4)
      FROM bom_items bi
      WHERE bi.bom_id = v_order.bom_id;
    END IF;
  END IF;

  -- Verificar stock de cada insumo
  FOR v_material IN
    SELECT
      pom.component_product_id,
      p.name AS component_name,
      pom.qty_required,
      COALESCE(SUM(im.qty_signed), 0) AS available
    FROM production_order_materials pom
    JOIN products p ON p.id = pom.component_product_id
    LEFT JOIN inventory_movements im ON im.product_id = pom.component_product_id
    WHERE pom.production_order_id = p_order_id
    GROUP BY pom.component_product_id, p.name, pom.qty_required
  LOOP
    IF v_material.available < v_material.qty_required THEN
      v_warnings := array_append(v_warnings,
        v_material.component_name || ': necesita ' || v_material.qty_required ||
        ', disponible ' || v_material.available);
    END IF;
  END LOOP;

  -- Iniciar aun con advertencias (el operador decide)
  UPDATE production_orders
  SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT
    true,
    ('Orden ' || v_order.order_number || ' iniciada')::TEXT,
    v_warnings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Función: completar producción ─────────────────────────────────────
-- Crea movimientos OUT para insumos y movimiento IN para producto terminado
CREATE OR REPLACE FUNCTION complete_production_order(
  p_order_id    UUID,
  p_qty_produced NUMERIC,
  p_operator_id  UUID DEFAULT NULL
)
RETURNS TABLE(
  success          BOOLEAN,
  message          TEXT,
  movements_created INT
) AS $$
DECLARE
  v_order         RECORD;
  v_movement_count INT := 0;
  v_material      RECORD;
BEGIN
  SELECT * INTO v_order FROM production_orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Orden no encontrada'::TEXT, 0;
    RETURN;
  END IF;

  IF v_order.status NOT IN ('in_progress', 'paused') THEN
    RETURN QUERY SELECT false,
      ('La orden debe estar en_progreso o pausada. Estado: ' || v_order.status)::TEXT, 0;
    RETURN;
  END IF;

  -- Crear movimientos OUT por cada insumo consumido
  FOR v_material IN
    SELECT * FROM production_order_materials WHERE production_order_id = p_order_id
  LOOP
    -- Consumo proporcional al qty_produced real vs qty_planned
    DECLARE
      v_qty_consume NUMERIC;
    BEGIN
      v_qty_consume := ROUND(
        v_material.qty_required * (p_qty_produced / v_order.qty_planned),
        4
      );

      IF v_qty_consume > 0 THEN
        INSERT INTO inventory_movements (
          movement_type, qty_signed, warehouse_id, product_id,
          user_id, ref_type, ref_id, notes
        ) VALUES (
          'OUT',
          -v_qty_consume,
          v_order.warehouse_id,
          v_material.component_product_id,
          COALESCE(p_operator_id, v_order.operator_id),
          'production_out',
          p_order_id,
          'Insumo consumido en ' || v_order.order_number
        );

        v_movement_count := v_movement_count + 1;

        -- Actualizar qty_consumed
        UPDATE production_order_materials
        SET qty_consumed = qty_consumed + v_qty_consume
        WHERE id = v_material.id;
      END IF;
    END;
  END LOOP;

  -- Crear movimiento IN para el producto terminado
  INSERT INTO inventory_movements (
    movement_type, qty_signed, warehouse_id, product_id,
    user_id, ref_type, ref_id, notes
  ) VALUES (
    'IN',
    p_qty_produced,
    v_order.warehouse_id,
    v_order.product_id,
    COALESCE(p_operator_id, v_order.operator_id),
    'production_in',
    p_order_id,
    'Producción completada: ' || v_order.order_number
  );

  v_movement_count := v_movement_count + 1;

  -- Actualizar orden
  UPDATE production_orders
  SET
    status       = 'completed',
    qty_produced = qty_produced + p_qty_produced,
    completed_at = NOW(),
    updated_at   = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT
    true,
    (v_order.order_number || ': ' || p_qty_produced || ' unidades producidas. ' ||
     v_movement_count || ' movimientos creados.')::TEXT,
    v_movement_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Extender ref_type de inventory_movements ──────────────────────────
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_ref_type_check;
-- No ponemos constraint para mantener flexibilidad (ref_type es libre)

-- ── 7. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE production_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_orders_select" ON production_orders FOR SELECT USING (true);
CREATE POLICY "production_orders_insert" ON production_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "production_orders_update" ON production_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "production_orders_delete" ON production_orders FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "prod_materials_select" ON production_order_materials FOR SELECT USING (true);
CREATE POLICY "prod_materials_insert" ON production_order_materials FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "prod_materials_update" ON production_order_materials FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "prod_materials_delete" ON production_order_materials FOR DELETE USING (auth.role() = 'authenticated');

COMMENT ON TABLE production_orders IS
'Órdenes de fabricación. Flujo: draft → in_progress → completed.
Al completar: se crean movimientos OUT para insumos (ref_type=production_out)
y un movimiento IN para el producto terminado (ref_type=production_in).';

COMMENT ON FUNCTION complete_production_order IS
'Ejecuta la producción: descuenta insumos del inventario y suma el producto terminado.
Los qty consumidos son proporcionales a qty_produced / qty_planned.';
