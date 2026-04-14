-- =====================================================
-- 044 — STRICT PRODUCTION START
-- =====================================================
-- Cambia start_production_order de "permisivo con advertencias"
-- a ESTRICTO: si algún insumo no tiene stock suficiente,
-- la OP NO se inicia y se devuelve success=false con la lista
-- completa de faltantes.
--
-- Razón: evitar que se arranquen OPs de productos terminados
-- sin haber producido primero los semi-terminados que consumen
-- como insumo (lo cual dejaba el semi en stock negativo).
--
-- El cálculo de disponible considera el stock reservado por
-- OTRAS OPs activas (in_progress/paused) — se apoya en
-- inventory_reserved_view de la migración 043.
-- =====================================================

CREATE OR REPLACE FUNCTION start_production_order(p_order_id UUID)
RETURNS TABLE(
  success   BOOLEAN,
  message   TEXT,
  warnings  TEXT[]
) AS $$
DECLARE
  v_order         RECORD;
  v_material      RECORD;
  v_blocking      TEXT[] := '{}';
  v_physical      NUMERIC;
  v_reserved      NUMERIC;
  v_available     NUMERIC;
BEGIN
  -- ── 1. Obtener orden ─────────────────────────────────
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

  -- ── 2. Poblar materiales desde BOM si no existen ─────
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

  -- ── 3. Validar stock de cada insumo (físico - reservado) ──
  -- El reservado NO incluye esta OP (aún es draft → no está en la vista)
  FOR v_material IN
    SELECT
      pom.component_product_id,
      p.name AS component_name,
      p.unit,
      pom.qty_required,
      COALESCE(stock.qty_on_hand, 0) AS physical,
      COALESCE(res.qty_reserved, 0) AS reserved
    FROM production_order_materials pom
    JOIN products p
      ON p.id = pom.component_product_id
    LEFT JOIN inventory_stock_view stock
      ON stock.product_id = pom.component_product_id
     AND stock.warehouse_id = v_order.warehouse_id
    LEFT JOIN inventory_reserved_view res
      ON res.product_id = pom.component_product_id
     AND res.warehouse_id = v_order.warehouse_id
    WHERE pom.production_order_id = p_order_id
  LOOP
    v_physical  := v_material.physical;
    v_reserved  := v_material.reserved;
    v_available := GREATEST(v_physical - v_reserved, 0);

    IF v_available < v_material.qty_required THEN
      v_blocking := array_append(v_blocking,
        format('%s: faltan %s %s (necesita %s, disponible %s%s)',
          v_material.component_name,
          (v_material.qty_required - v_available)::TEXT,
          COALESCE(v_material.unit, 'uds'),
          v_material.qty_required::TEXT,
          v_available::TEXT,
          CASE WHEN v_reserved > 0
               THEN ' — ' || v_reserved::TEXT || ' reservado en otras OPs'
               ELSE '' END
        )
      );
    END IF;
  END LOOP;

  -- ── 4. Si hay faltantes → RECHAZAR (estricto) ────────
  IF array_length(v_blocking, 1) > 0 THEN
    RETURN QUERY SELECT
      false,
      ('No se puede iniciar: stock insuficiente en ' || array_length(v_blocking, 1) || ' insumo(s). '
        || 'Produce primero los semi-terminados o recibe más insumos.')::TEXT,
      v_blocking;
    RETURN;
  END IF;

  -- ── 5. Todo OK → iniciar OP ──────────────────────────
  UPDATE production_orders
  SET status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT
    true,
    ('Orden ' || v_order.order_number || ' iniciada')::TEXT,
    '{}'::TEXT[];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION start_production_order(UUID) IS
'Valida stock disponible (físico - reservado por OPs activas) de cada insumo. Si algún insumo no alcanza, RECHAZA el inicio y devuelve la lista completa de faltantes en warnings. Reemplaza la versión permisiva de 036.';
