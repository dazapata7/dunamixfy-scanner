-- =====================================================
-- MIGRATION 007: Agregar foto a productos
-- =====================================================
-- Fecha: 2026-02-05
-- Propósito: Agregar campo photo_url para fotos de productos
-- =====================================================

-- Agregar columna photo_url a products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentario
COMMENT ON COLUMN products.photo_url IS 'URL de la foto principal del producto (puede ser Supabase Storage o URL externa)';

-- Crear bucket en Supabase Storage para fotos de productos
-- Nota: Esto debe ejecutarse también desde el dashboard de Supabase
-- Storage → Create Bucket → Name: "product-photos", Public: true

-- Opcional: Si se quiere tener múltiples fotos, crear tabla adicional
-- (Por ahora solo foto principal en products.photo_url)

-- Índice para búsquedas (aunque no es crítico)
CREATE INDEX IF NOT EXISTS idx_products_photo_url ON products(photo_url) WHERE photo_url IS NOT NULL;

-- =====================================================
-- Actualizar vista inventory_stock_view para incluir photo_url
-- =====================================================
-- Primero eliminar la vista existente
DROP VIEW IF EXISTS inventory_stock_view;

-- Recrear la vista con la nueva columna photo_url
CREATE VIEW inventory_stock_view AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  p.barcode,
  p.photo_url,  -- NUEVO: Agregar foto del producto
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  COALESCE(SUM(im.qty_signed), 0) AS qty_on_hand
FROM products p
CROSS JOIN warehouses w
LEFT JOIN inventory_movements im
  ON im.product_id = p.id
  AND im.warehouse_id = w.id
WHERE p.is_active = true
  AND w.is_active = true
GROUP BY p.id, p.sku, p.name, p.barcode, p.photo_url, w.id, w.code, w.name;

COMMENT ON VIEW inventory_stock_view IS 'Vista de stock actual por producto y almacén con foto (calculado desde movimientos)';
