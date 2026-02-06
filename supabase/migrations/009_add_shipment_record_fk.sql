-- =====================================================
-- MIGRATION 009: Agregar Foreign Key shipment_record_id
-- =====================================================
-- Problema: Dashboard WMS falla con error PGRST200
-- "Could not find a relationship between 'dispatches' and 'shipment_records'"
--
-- Solución: Agregar columna shipment_record_id a dispatches
-- =====================================================

-- 1. Agregar columna shipment_record_id a dispatches (nullable)
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS shipment_record_id UUID REFERENCES shipment_records(id);

-- 2. Crear índice para mejorar performance en joins
CREATE INDEX IF NOT EXISTS idx_dispatches_shipment_record_id
ON dispatches(shipment_record_id);

-- 3. Comentario de documentación
COMMENT ON COLUMN dispatches.shipment_record_id IS 'FK a shipment_records - vincula dispatch con registro de envío original (API o CSV)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Después de ejecutar, verificar con:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'dispatches' AND column_name = 'shipment_record_id';
