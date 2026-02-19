-- =====================================================
-- Migration 030: Fix dispatch_number race condition
-- =====================================================
-- PROBLEMA: generate_dispatch_number() usaba COUNT(*)+1
-- lo que causaba que llamadas concurrentes generaran el mismo número
-- SOLUCIÓN: Usar una secuencia PostgreSQL (atómica por definición)
-- =====================================================

-- 1. Crear secuencia global para dispatch_number (si no existe)
CREATE SEQUENCE IF NOT EXISTS dispatch_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- 2. Reemplazar la función con una versión atómica usando la secuencia
CREATE OR REPLACE FUNCTION generate_dispatch_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  seq_val   BIGINT;
BEGIN
  date_part := to_char(CURRENT_DATE, 'YYYYMMDD');
  seq_val   := nextval('dispatch_number_seq');

  -- Formato: DSP-20260219-0001 (4 dígitos para soportar >999 por día)
  RETURN 'DSP-' || date_part || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_dispatch_number() IS
  'Genera número único de despacho usando secuencia atómica - DSP-YYYYMMDD-0001';
