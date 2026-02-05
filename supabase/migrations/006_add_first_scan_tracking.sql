-- =====================================================
-- MIGRATION 006: Agregar trazabilidad de primer escaneo
-- =====================================================
-- Fecha: 2026-02-05
-- Propósito: Agregar campos para rastrear el primer escaneo de guías
-- =====================================================

-- Agregar columna first_scanned_at a dispatches
-- Esta columna registra la fecha/hora del PRIMER escaneo de la guía
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS first_scanned_at TIMESTAMP WITH TIME ZONE;

-- Agregar columna first_scanned_by a dispatches
-- Registra quién hizo el primer escaneo
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS first_scanned_by UUID REFERENCES operators(id) ON DELETE SET NULL;

-- Índice para búsquedas por fecha de primer escaneo
CREATE INDEX IF NOT EXISTS idx_dispatches_first_scanned_at
ON dispatches(first_scanned_at) WHERE first_scanned_at IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN dispatches.first_scanned_at IS 'Fecha y hora del primer escaneo de la guía (trazabilidad)';
COMMENT ON COLUMN dispatches.first_scanned_by IS 'Operador que realizó el primer escaneo';

-- Actualizar dispatches existentes para marcar created_at como first_scanned_at
-- Solo para registros que ya tienen guide_code
UPDATE dispatches
SET first_scanned_at = created_at
WHERE first_scanned_at IS NULL
  AND guide_code IS NOT NULL;

-- =====================================================
-- Agregar función para auto-marcar primer escaneo
-- =====================================================
CREATE OR REPLACE FUNCTION set_first_scanned_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Si first_scanned_at es NULL y hay guide_code, marcar ahora
  IF NEW.first_scanned_at IS NULL AND NEW.guide_code IS NOT NULL THEN
    NEW.first_scanned_at := timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-marcar en INSERT
CREATE TRIGGER trigger_set_first_scanned_at
  BEFORE INSERT ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION set_first_scanned_timestamp();

COMMENT ON FUNCTION set_first_scanned_timestamp() IS 'Auto-marca first_scanned_at al crear dispatch con guía';

-- =====================================================
-- Vista para historial de escaneos
-- =====================================================
CREATE OR REPLACE VIEW dispatch_scan_history AS
SELECT
  d.id,
  d.dispatch_number,
  d.guide_code,
  d.warehouse_id,
  w.name as warehouse_name,
  d.carrier_id,
  c.display_name as carrier_name,
  d.first_scanned_at,
  d.first_scanned_by,
  o.name as first_scanned_by_name,
  d.status,
  d.confirmed_at,
  d.created_at,
  -- Duración entre escaneo y confirmación
  CASE
    WHEN d.confirmed_at IS NOT NULL AND d.first_scanned_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (d.confirmed_at - d.first_scanned_at))
    ELSE NULL
  END as seconds_to_confirm
FROM dispatches d
LEFT JOIN warehouses w ON w.id = d.warehouse_id
LEFT JOIN carriers c ON c.id = d.carrier_id
LEFT JOIN operators o ON o.id = d.first_scanned_by
WHERE d.guide_code IS NOT NULL
ORDER BY d.first_scanned_at DESC;

COMMENT ON VIEW dispatch_scan_history IS 'Historial de escaneos de guías con trazabilidad completa';
