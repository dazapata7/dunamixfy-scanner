-- =====================================================
-- Migration 035: BOM completo (Bill of Materials)
-- =====================================================
-- Evoluciona product_combo_components a un BOM versionado completo.
-- bom_headers: encabezado por producto (versiones)
-- bom_items:   componentes con qty, factor de merma, unidad
-- =====================================================

-- ── 1. bom_headers ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bom_headers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version      INT  NOT NULL DEFAULT 1,
  is_active    BOOLEAN DEFAULT TRUE,
  description  TEXT,
  notes        TEXT,
  created_by   UUID REFERENCES operators(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, version)
);

CREATE INDEX IF NOT EXISTS idx_bom_headers_product ON bom_headers(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_active  ON bom_headers(is_active);

-- ── 2. bom_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bom_items (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id               UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty_required         NUMERIC(12, 4) NOT NULL DEFAULT 1,
  unit_of_measure      TEXT DEFAULT 'unidad',
  waste_factor         NUMERIC(5, 4) DEFAULT 1.0000, -- 1.0500 = 5% merma
  notes                TEXT,
  sort_order           INT DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bom_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_bom_items_bom        ON bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_component  ON bom_items(component_product_id);

-- ── 3. Función: qty real a consumir = qty_required × waste_factor × qty_to_produce
-- Comentario de diseño: el consumo real se calcula en el servicio JS,
-- esta columna virtual no es necesaria en BD.

-- ── 4. Migrar product_combo_components → bom_headers + bom_items ─────────
DO $$
DECLARE
  r RECORD;
  v_bom_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT combo_product_id FROM product_combo_components
  LOOP
    -- Crear bom_header para este combo (si no existe ya)
    INSERT INTO bom_headers (product_id, version, description)
    VALUES (r.combo_product_id, 1, 'Migrado desde combos')
    ON CONFLICT (product_id, version) DO NOTHING
    RETURNING id INTO v_bom_id;

    IF v_bom_id IS NULL THEN
      SELECT id INTO v_bom_id FROM bom_headers
      WHERE product_id = r.combo_product_id AND version = 1;
    END IF;

    -- Insertar bom_items desde product_combo_components
    INSERT INTO bom_items (bom_id, component_product_id, qty_required)
    SELECT v_bom_id, pcc.component_product_id, pcc.quantity
    FROM product_combo_components pcc
    WHERE pcc.combo_product_id = r.combo_product_id
    ON CONFLICT (bom_id, component_product_id) DO NOTHING;

  END LOOP;

  RAISE NOTICE '✅ Migración product_combo_components → bom completada';
END;
$$;

-- ── 5. Función helper: obtener BOM activo de un producto ─────────────────
CREATE OR REPLACE FUNCTION get_active_bom(p_product_id UUID)
RETURNS TABLE(
  bom_id               UUID,
  version              INT,
  component_product_id UUID,
  component_name       TEXT,
  component_sku        TEXT,
  qty_required         NUMERIC,
  waste_factor         NUMERIC,
  qty_with_waste       NUMERIC,
  unit_of_measure      TEXT,
  notes                TEXT,
  sort_order           INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bh.id,
    bh.version,
    bi.component_product_id,
    p.name,
    p.sku,
    bi.qty_required,
    bi.waste_factor,
    ROUND(bi.qty_required * bi.waste_factor, 4) AS qty_with_waste,
    bi.unit_of_measure,
    bi.notes,
    bi.sort_order
  FROM bom_headers bh
  JOIN bom_items bi ON bi.bom_id = bh.id
  JOIN products p   ON p.id = bi.component_product_id
  WHERE bh.product_id = p_product_id
    AND bh.is_active = TRUE
  ORDER BY bi.sort_order, bi.created_at;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── 6. Función: calcular materiales necesarios para N unidades ────────────
CREATE OR REPLACE FUNCTION calculate_materials_required(
  p_product_id UUID,
  p_qty        NUMERIC
)
RETURNS TABLE(
  component_product_id UUID,
  component_name       TEXT,
  component_sku        TEXT,
  qty_required         NUMERIC,
  qty_available        NUMERIC,
  has_sufficient_stock BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.component_product_id,
    prod.name,
    prod.sku,
    ROUND(bi.qty_required * bi.waste_factor * p_qty, 4) AS qty_required,
    COALESCE(stock.qty_on_hand, 0) AS qty_available,
    COALESCE(stock.qty_on_hand, 0) >= ROUND(bi.qty_required * bi.waste_factor * p_qty, 4) AS has_sufficient_stock
  FROM bom_headers bh
  JOIN bom_items bi     ON bi.bom_id = bh.id
  JOIN products prod    ON prod.id = bi.component_product_id
  LEFT JOIN (
    SELECT product_id, SUM(qty_signed) AS qty_on_hand
    FROM inventory_movements
    GROUP BY product_id
  ) stock ON stock.product_id = bi.component_product_id
  WHERE bh.product_id = p_product_id
    AND bh.is_active = TRUE
  ORDER BY bi.sort_order;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── 7. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bom_headers_select" ON bom_headers FOR SELECT USING (true);
CREATE POLICY "bom_headers_insert" ON bom_headers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "bom_headers_update" ON bom_headers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "bom_headers_delete" ON bom_headers FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "bom_items_select" ON bom_items FOR SELECT USING (true);
CREATE POLICY "bom_items_insert" ON bom_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "bom_items_update" ON bom_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "bom_items_delete" ON bom_items FOR DELETE USING (auth.role() = 'authenticated');
