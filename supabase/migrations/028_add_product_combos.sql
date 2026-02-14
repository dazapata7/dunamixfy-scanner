-- =====================================================
-- Migration 028: Agregar soporte para Productos Combo
-- =====================================================
-- Permite crear productos compuestos (combos) que se descomponen
-- automáticamente en sus componentes al crear dispatches.
--
-- Ejemplo:
--   Producto: "Combo Terapia Dolor"
--   Componentes: Rodillax x1 + Lumbrax x1
--   Al despachar 1 combo → descuenta 1 Rodillax + 1 Lumbrax del inventario
-- =====================================================

-- 1. Agregar campo type a products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'simple' NOT NULL
CHECK (type IN ('simple', 'combo'));

-- Comentario
COMMENT ON COLUMN products.type IS 'Tipo de producto: simple (individual) o combo (compuesto de otros productos)';

-- 2. Crear tabla de componentes de combos
CREATE TABLE IF NOT EXISTS product_combo_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Un combo NO puede contener a sí mismo
  CONSTRAINT combo_not_self CHECK (combo_product_id != component_product_id),

  -- Evitar duplicados (mismo componente en el mismo combo)
  CONSTRAINT unique_component_per_combo UNIQUE (combo_product_id, component_product_id)
);

-- Índice para búsqueda rápida de componentes por combo
CREATE INDEX IF NOT EXISTS idx_combo_components_combo
ON product_combo_components(combo_product_id);

-- Índice para búsqueda inversa (qué combos contienen X producto)
CREATE INDEX IF NOT EXISTS idx_combo_components_component
ON product_combo_components(component_product_id);

-- 3. Función: Validar que componente sea producto simple (no combo)
CREATE OR REPLACE FUNCTION check_component_is_simple()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM products
    WHERE id = NEW.component_product_id AND type != 'simple'
  ) THEN
    RAISE EXCEPTION 'Solo se pueden agregar productos simples como componentes de un combo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Validar componentes al insertar/actualizar
CREATE TRIGGER enforce_simple_components
  BEFORE INSERT OR UPDATE ON product_combo_components
  FOR EACH ROW
  EXECUTE FUNCTION check_component_is_simple();

-- 4. Row Level Security
ALTER TABLE product_combo_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
  ON product_combo_components FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users"
  ON product_combo_components FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users"
  ON product_combo_components FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users"
  ON product_combo_components FOR DELETE USING (true);

-- 5. Comentarios
COMMENT ON TABLE product_combo_components IS 'Componentes de productos combo. Define qué productos y cantidades forman un combo.';
COMMENT ON COLUMN product_combo_components.combo_product_id IS 'ID del producto combo (debe tener type=combo)';
COMMENT ON COLUMN product_combo_components.component_product_id IS 'ID del producto componente (debe tener type=simple)';
COMMENT ON COLUMN product_combo_components.quantity IS 'Cantidad del componente en el combo';

-- 6. Ejemplo de uso (comentado - descomentar para testing)
/*
-- Crear productos simples
INSERT INTO products (sku, name, type) VALUES
  ('ROD120', 'Rodillax 120ml', 'simple'),
  ('LUM120', 'Lumbrax 120ml', 'simple');

-- Crear producto combo
INSERT INTO products (sku, name, type) VALUES
  ('COMBO-DOLOR-001', 'Combo Terapia Dolor', 'combo');

-- Definir componentes del combo
INSERT INTO product_combo_components (combo_product_id, component_product_id, quantity)
SELECT
  (SELECT id FROM products WHERE sku = 'COMBO-DOLOR-001'),
  (SELECT id FROM products WHERE sku = 'ROD120'),
  1
UNION ALL
SELECT
  (SELECT id FROM products WHERE sku = 'COMBO-DOLOR-001'),
  (SELECT id FROM products WHERE sku = 'LUM120'),
  1;
*/
