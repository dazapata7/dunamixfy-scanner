-- ============================================
-- MIGRATION: Agregar columna store_name
-- ============================================
-- Si ya tienes datos en la base de datos, ejecuta esto
-- en lugar del schema completo
-- ============================================

-- 1. Agregar columna store_name a la tabla codes
ALTER TABLE codes 
ADD COLUMN IF NOT EXISTS store_name TEXT;

-- 2. Agregar comentario a la columna
COMMENT ON COLUMN codes.store_name IS 'Nombre de la tienda de origen';

-- 3. Crear índice para mejorar búsquedas por tienda
CREATE INDEX IF NOT EXISTS idx_codes_store ON codes(store_name);

-- 4. Verificar que se agregó correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'codes'
AND column_name = 'store_name';

-- ============================================
-- RESULTADO ESPERADO:
-- column_name  | data_type | is_nullable
-- store_name   | text      | YES
-- ============================================
