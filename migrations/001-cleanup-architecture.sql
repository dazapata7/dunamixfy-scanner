-- ============================================
-- FASE 1: LIMPIEZA DE ARQUITECTURA
-- ============================================
-- Objetivo: Simplificar base de datos eliminando tablas redundantes
-- Dunamixfy es la única fuente de verdad para stores y orders
-- Scanner mantiene solo log transitorio en tabla codes (7 días)

-- PASO 1: Eliminar tabla STORES (redundante - viene de Dunamixfy)
-- ============================================
DROP TABLE IF EXISTS stores CASCADE;

-- PASO 2: Eliminar tabla ORDERS (redundante - Dunamixfy es fuente de verdad)
-- ============================================
DROP TABLE IF EXISTS orders CASCADE;

-- PASO 3: Simplificar tabla CODES - Agregar campos de caché mínimo
-- ============================================
-- Agregar campos para cachear info básica de Dunamixfy (evitar re-consultas innecesarias)

-- Campo: order_id (opcional - para referencia)
ALTER TABLE codes ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Campo: customer_name (para mostrar en UI sin consultar API)
ALTER TABLE codes ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Campo: carrier_name (cache del nombre de transportadora)
ALTER TABLE codes ADD COLUMN IF NOT EXISTS carrier_name TEXT;

-- Campo: store_name (cache del nombre de tienda)
ALTER TABLE codes ADD COLUMN IF NOT EXISTS store_name TEXT;

-- PASO 4: Índices para optimización
-- ============================================
-- Índice en order_id para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_codes_order_id ON codes(order_id);

-- Índice en scanned_at para limpieza de datos antiguos (7 días)
CREATE INDEX IF NOT EXISTS idx_codes_scanned_at ON codes(scanned_at);

-- PASO 5: Función para auto-limpieza de datos antiguos (7 días)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM codes
  WHERE scanned_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- PASO 6: Verificar estructura final
-- ============================================
-- Verificar columnas de tabla codes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'codes'
ORDER BY ordinal_position;

-- Verificar índices
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'codes';
