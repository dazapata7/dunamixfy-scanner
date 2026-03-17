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

-- Estrategia de extracción: desde el FINAL del código (prefix varía, suffix es fijo)
--
-- Barcode: 739725853690001          (15 chars) → slice(-14, -3) = 39725853690
-- QR:      70020010200040630339725853690001  (32 chars) → slice(-14, -3) = 39725853690
--
-- Regla: return_barcode_guide_length + return_barcode_suffix_length = chars desde el final
--   Ej: 11 + 3 = 14  →  code.slice(-14, -3)

ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS return_barcode_guide_length   integer,
  ADD COLUMN IF NOT EXISTS return_barcode_suffix_length  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_tracking_url           text;

COMMENT ON COLUMN carriers.return_barcode_guide_length  IS 'Longitud de la guía en el barcode (ej: 11 para Coordinadora)';
COMMENT ON COLUMN carriers.return_barcode_suffix_length IS 'Chars a ignorar al final del barcode (ej: 3 para el "001" de Coordinadora)';
COMMENT ON COLUMN carriers.return_tracking_url          IS 'URL base de rastreo de devoluciones';

-- Aplicar configuración a Coordinadora
UPDATE carriers
   SET return_barcode_guide_length  = 11,
       return_barcode_suffix_length = 3,
       return_tracking_url          = 'https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia='
 WHERE LOWER(name) LIKE '%coordinadora%'
    OR LOWER(code) LIKE '%coordinadora%';
