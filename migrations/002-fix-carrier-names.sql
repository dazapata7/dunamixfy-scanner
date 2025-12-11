-- Migración 002: Actualizar carrier_name a 'Coordinadora'
-- Fecha: 2025-01-XX
-- Descripción: Corregir todos los carrier_name existentes para que sean 'Coordinadora'
--
-- IMPORTANTE: Esta migración solo afecta datos existentes en la BD.
-- Los nuevos escaneos deberían importar carrier_name correctamente desde Dunamixfy.

-- 1. Ver cuántos registros tienen carrier_name diferente a 'Coordinadora' (incluyendo NULL)
SELECT
    COALESCE(carrier_name, 'NULL') as carrier_name,
    COUNT(*) as cantidad
FROM codes
GROUP BY carrier_name
ORDER BY cantidad DESC;

-- 2. Actualizar todos los carrier_name a 'Coordinadora'
-- Incluye tanto los que tienen nombre diferente como los NULL
UPDATE codes
SET carrier_name = 'Coordinadora'
WHERE carrier_name IS NULL
   OR carrier_name != 'Coordinadora';

-- 3. Verificar el resultado (no debería haber NULL ni otros nombres)
SELECT
    COALESCE(carrier_name, 'NULL') as carrier_name,
    COUNT(*) as cantidad
FROM codes
GROUP BY carrier_name
ORDER BY cantidad DESC;

-- 4. Ver algunos ejemplos de registros actualizados
SELECT
    id,
    code,
    carrier_name,
    store_name,
    customer_name,
    created_at
FROM codes
WHERE carrier_name = 'Coordinadora'
ORDER BY created_at DESC
LIMIT 10;
