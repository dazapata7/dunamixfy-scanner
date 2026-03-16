-- =====================================================
-- MIGRATION 037: Módulo de Devoluciones
-- =====================================================
-- Tablas: returns, return_items
-- Función: generate_return_number, confirm_return
-- =====================================================

-- ── Función: generar número de devolución ─────────────
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS text AS $$
DECLARE
  today text := TO_CHAR(NOW() AT TIME ZONE 'America/Bogota', 'YYYYMMDD');
  seq   int;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(return_number, '-', 3) AS int)), 0) + 1
    INTO seq
    FROM returns
   WHERE return_number LIKE 'RET-' || today || '-%';

  RETURN 'RET-' || today || '-' || LPAD(seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Tabla principal de devoluciones ───────────────────
CREATE TABLE returns (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number        text        UNIQUE NOT NULL,
  -- Guía de devolución (la que se escanea, formato diferente al original)
  return_guide_code    text        NOT NULL,
  -- Guía original (encontrada en el tracking de Coordinadora)
  original_guide_code  text,
  -- Dispatch original al que pertenece (si se encontró en la BD)
  original_dispatch_id uuid        REFERENCES dispatches(id) ON DELETE SET NULL,
  warehouse_id         uuid        NOT NULL REFERENCES warehouses(id),
  operator_id          uuid        REFERENCES operators(id),
  carrier_id           uuid        REFERENCES carriers(id),
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  confirmed_at         timestamptz
);

-- ── Ítems de la devolución ────────────────────────────
CREATE TABLE return_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id   uuid    NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id  uuid    NOT NULL REFERENCES products(id),
  qty         integer NOT NULL CHECK (qty > 0),
  -- Estado del producto devuelto
  condition   text    NOT NULL DEFAULT 'good'
                      CHECK (condition IN ('good', 'damaged')),
  notes       text
);

-- ── Índices ───────────────────────────────────────────
CREATE INDEX idx_returns_warehouse    ON returns(warehouse_id);
CREATE INDEX idx_returns_status       ON returns(status);
CREATE INDEX idx_returns_guide_codes  ON returns(return_guide_code, original_guide_code);
CREATE INDEX idx_return_items_return  ON return_items(return_id);

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_returns" ON returns FOR ALL USING (
  warehouse_id IN (
    SELECT w.id FROM warehouses w
    INNER JOIN operators op ON op.company_id = w.company_id
    WHERE op.user_id = auth.uid()
  )
);

CREATE POLICY "company_return_items" ON return_items FOR ALL USING (
  return_id IN (SELECT id FROM returns)
);

-- ── Función: confirmar devolución ─────────────────────
-- Crea movimientos IN de inventario por cada ítem
CREATE OR REPLACE FUNCTION confirm_return(
  p_return_id   uuid,
  p_operator_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_return  returns%ROWTYPE;
  v_item    return_items%ROWTYPE;
BEGIN
  -- Cargar y validar devolución
  SELECT * INTO v_return
    FROM returns
   WHERE id = p_return_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolución no encontrada o no está en estado borrador';
  END IF;

  -- Validar que tenga ítems
  IF NOT EXISTS (SELECT 1 FROM return_items WHERE return_id = p_return_id) THEN
    RAISE EXCEPTION 'La devolución no tiene productos asociados';
  END IF;

  -- Crear movimiento IN por cada ítem
  FOR v_item IN
    SELECT * FROM return_items WHERE return_id = p_return_id
  LOOP
    INSERT INTO inventory_movements (
      movement_type,
      qty_signed,
      warehouse_id,
      product_id,
      user_id,
      ref_type,
      ref_id,
      description
    ) VALUES (
      'IN',
      v_item.qty,
      v_return.warehouse_id,
      v_item.product_id,
      p_operator_id,
      'return',
      p_return_id,
      'Devolución ' || v_return.return_number
    );
  END LOOP;

  -- Confirmar devolución
  UPDATE returns
     SET status       = 'confirmed',
         confirmed_at = now()
   WHERE id = p_return_id;

  RETURN jsonb_build_object(
    'success',       true,
    'return_number', v_return.return_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Comentarios ───────────────────────────────────────
COMMENT ON TABLE returns IS 'Devoluciones de pedidos escaneadas en WMS';
COMMENT ON TABLE return_items IS 'Productos incluidos en cada devolución';
COMMENT ON COLUMN returns.return_guide_code  IS 'Guía de devolución escaneada (formato diferente al despacho original)';
COMMENT ON COLUMN returns.original_guide_code IS 'Guía original encontrada via tracking de Coordinadora';
COMMENT ON COLUMN return_items.condition IS 'Estado del producto al ser devuelto: good=buen estado, damaged=dañado';
