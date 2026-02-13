-- =====================================================
-- Migration 027: Agregar external_product_id a shipment_items
-- =====================================================
-- Agregar columna para guardar el PRODUCTO ID del CSV de Interrápidisimo
-- Este es el ID real del producto en Dunamix, no el SKU
-- Permite mapeo correcto entre productos del CSV y productos internos
-- =====================================================

-- Agregar columna external_product_id
ALTER TABLE shipment_items
ADD COLUMN IF NOT EXISTS external_product_id TEXT;

-- Comentario
COMMENT ON COLUMN shipment_items.external_product_id IS 'ID del producto en sistema externo (PRODUCTO ID del CSV Interrápidisimo)';

-- Índice para búsquedas por external_product_id
CREATE INDEX IF NOT EXISTS idx_shipment_items_external_product
ON shipment_items(external_product_id)
WHERE external_product_id IS NOT NULL;
