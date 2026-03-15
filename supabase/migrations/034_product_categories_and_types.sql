-- =====================================================
-- Migration 034: Categorías de productos + tipos extendidos
-- =====================================================

-- ── 1. Tabla de categorías (árbol con parent_id) ──────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  icon       TEXT,          -- emoji o nombre de icono (ej: '📦', 'package')
  color      TEXT,          -- color hex (ej: '#0afdbd')
  sort_order INT  DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_parent   ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_company  ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_active   ON product_categories(is_active);

-- ── 2. Agregar category_id a products ────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ── 3. Extender tipos de producto ─────────────────────────────────────────
-- Eliminar constraint anterior si existe
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check;

-- Agregar constraint con tipos completos (backward-compatible)
ALTER TABLE products ADD CONSTRAINT products_type_check
  CHECK (type IN (
    'simple',        -- producto simple genérico (legacy)
    'combo',         -- kit/bundle de varios productos (legacy, migra a BOM)
    'raw_material',  -- insumo de fabricación (cajas, etiquetas, envases, gráneles)
    'finished_good', -- producto terminado listo para vender
    'semi_finished', -- producto en proceso intermedio
    'consumable'     -- material de uso interno (embalaje, tape, etc.)
  ));

-- ── 4. Categorías semilla (insumos y productos comunes) ──────────────────
-- Solo se insertan si la tabla está vacía (primera vez)
INSERT INTO product_categories (name, icon, color, sort_order)
SELECT name, icon, color, sort_order FROM (VALUES
  ('Insumos de Fabricación', '🏭', '#f59e0b', 1),
  ('Productos Terminados',   '✅', '#0afdbd', 2),
  ('Embalaje y Empaque',     '📦', '#3b82f6', 3),
  ('Consumibles Internos',   '🔧', '#8b5cf6', 4)
) AS v(name, icon, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM product_categories LIMIT 1);

-- Sub-categorías de Insumos
WITH parent AS (SELECT id FROM product_categories WHERE name = 'Insumos de Fabricación' LIMIT 1)
INSERT INTO product_categories (name, icon, color, parent_id, sort_order)
SELECT v.name, v.icon, v.color, parent.id, v.sort_order
FROM parent, (VALUES
  ('Envases y Frascos', '🫙', '#f59e0b', 1),
  ('Etiquetas',         '🏷️', '#f59e0b', 2),
  ('Cajas y Estuches',  '📫', '#f59e0b', 3),
  ('Gráneles / Materias Primas', '🧪', '#f59e0b', 4)
) AS v(name, icon, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM product_categories WHERE parent_id IS NOT NULL LIMIT 1);

-- ── 5. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_select" ON product_categories FOR SELECT USING (true);
CREATE POLICY "product_categories_insert" ON product_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "product_categories_update" ON product_categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "product_categories_delete" ON product_categories FOR DELETE USING (auth.role() = 'authenticated');
