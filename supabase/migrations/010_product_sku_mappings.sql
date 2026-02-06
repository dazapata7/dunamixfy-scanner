-- =====================================================
-- MIGRATION 010: Tabla de Mapeo de SKUs Externos
-- =====================================================
-- Problema: Dunamixfy e Interrápidisimo usan SKUs diferentes
-- Solución: Tabla de mapeo source → external_sku → product_id
-- =====================================================

-- 1. Crear tabla de mapeo
CREATE TABLE product_sku_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('dunamixfy', 'interrapidisimo', 'csv', 'manual', 'other')),
  external_sku TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Un SKU externo solo puede mapear a un producto por fuente
  UNIQUE(source, external_sku)
);

-- 2. Índice para búsquedas rápidas por source + external_sku
CREATE INDEX idx_sku_mappings_lookup ON product_sku_mappings(source, external_sku) WHERE is_active = true;

-- 3. Índice para buscar todos los mappings de un producto
CREATE INDEX idx_sku_mappings_by_product ON product_sku_mappings(product_id) WHERE is_active = true;

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_product_sku_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_sku_mappings_updated_at
BEFORE UPDATE ON product_sku_mappings
FOR EACH ROW
EXECUTE FUNCTION update_product_sku_mappings_updated_at();

-- 5. RLS Policies (Row Level Security)
ALTER TABLE product_sku_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer mappings activos
CREATE POLICY "Permitir lectura de mappings activos"
ON product_sku_mappings
FOR SELECT
USING (is_active = true);

-- Policy: Usuarios autenticados pueden insertar
CREATE POLICY "Permitir inserción de mappings"
ON product_sku_mappings
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy: Usuarios autenticados pueden actualizar
CREATE POLICY "Permitir actualización de mappings"
ON product_sku_mappings
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Policy: Usuarios autenticados pueden eliminar
CREATE POLICY "Permitir eliminación de mappings"
ON product_sku_mappings
FOR DELETE
USING (auth.role() = 'authenticated');

-- 6. Comentarios de documentación
COMMENT ON TABLE product_sku_mappings IS 'Mapeo de SKUs externos (Dunamixfy, Interrápidisimo) a productos internos';
COMMENT ON COLUMN product_sku_mappings.source IS 'Fuente del SKU externo: dunamixfy, interrapidisimo, csv, manual, other';
COMMENT ON COLUMN product_sku_mappings.external_sku IS 'SKU usado por la fuente externa (ej: "210" en Dunamixfy)';
COMMENT ON COLUMN product_sku_mappings.product_id IS 'Producto interno al que mapea este SKU externo';

-- =====================================================
-- DATOS DE EJEMPLO (opcional - borrar después de probar)
-- =====================================================
-- INSERT INTO product_sku_mappings (product_id, source, external_sku, notes)
-- VALUES
--   ((SELECT id FROM products WHERE sku = 'LUMBRAX-120ML' LIMIT 1), 'dunamixfy', '210', 'Lumbrax 120ml en Dunamixfy'),
--   ((SELECT id FROM products WHERE sku = 'RODILLAX-50ML' LIMIT 1), 'dunamixfy', '211', 'Rodillax 50ml en Dunamixfy');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT * FROM product_sku_mappings;
