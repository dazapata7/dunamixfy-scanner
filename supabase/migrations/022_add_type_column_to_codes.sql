-- =====================================================
-- Migration 022: Agregar columna 'type' a tabla codes
-- =====================================================
-- Arregla error: Could not find the 'type' column of 'codes'
-- Tabla 'codes' es legacy del scanner DMX5 original
-- =====================================================

-- Agregar columna 'type' si no existe
ALTER TABLE codes
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'guide';

-- Comentario
COMMENT ON COLUMN codes.type IS 'Tipo de código: guide (guía WMS), qr (QR genérico), barcode (código de barras)';

-- Crear índice para mejorar queries
CREATE INDEX IF NOT EXISTS idx_codes_type ON codes(type);

COMMENT ON TABLE codes IS 'Tabla legacy del scanner DMX5 - mantiene compatibilidad con sistema original';
