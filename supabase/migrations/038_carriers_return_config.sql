-- =====================================================
-- MIGRATION 038: Configuración de devoluciones por transportadora
-- =====================================================
-- Agrega campos de configuración de barcode de devolución
-- para que cada transportadora pueda tener su propio patrón.
--
-- Ejemplo Coordinadora:
--   Barcode escaneado: 739725853690001  (15 dígitos)
--   return_barcode_total_length = 15
--   return_barcode_prefix       = 1     (saltar primer dígito "7")
--   return_barcode_guide_length = 11    (extraer 11 dígitos = guía real)
--
-- Extracción: code.slice(prefix, prefix + guide_length)
-- =====================================================

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS return_barcode_total_length  integer,
  ADD COLUMN IF NOT EXISTS return_barcode_prefix        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_barcode_guide_length  integer,
  ADD COLUMN IF NOT EXISTS return_tracking_url          text;

COMMENT ON COLUMN carriers.return_barcode_total_length IS 'Longitud total del barcode de devolución (ej: 15 para Coordinadora)';
COMMENT ON COLUMN carriers.return_barcode_prefix       IS 'Caracteres a saltar al inicio del barcode (ej: 1 para el "7" de Coordinadora)';
COMMENT ON COLUMN carriers.return_barcode_guide_length IS 'Longitud de la guía dentro del barcode (ej: 11 para Coordinadora)';
COMMENT ON COLUMN carriers.return_tracking_url         IS 'URL base de rastreo de devoluciones (ej: https://coordinadora.com/rastreo/...)';

-- Aplicar configuración a Coordinadora (ajusta el name si es diferente en tu BD)
UPDATE carriers
   SET return_barcode_total_length = 15,
       return_barcode_prefix       = 1,
       return_barcode_guide_length = 11,
       return_tracking_url         = 'https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia='
 WHERE LOWER(name) LIKE '%coordinadora%'
    OR LOWER(code) LIKE '%coordinadora%';
