-- Migración 002: Actualizar carrier_name a 'Coordinadora'
-- Fecha: 2025-01-XX
-- Descripción: Corregir todos los carrier_name existentes para que sean 'Coordinadora'
--
-- IMPORTANTE: Esta migración solo afecta datos existentes en la BD.
-- Los nuevos escaneos deberían importar carrier_name correctamente desde Dunamixfy.

-- 1. Ver cuántos registros tienen carrier_name diferente a 'Coordinadora'
SELECT
    carrier_name,
    COUNT(*) as cantidad
FROM codes
WHERE carrier_name IS NOT NULL
GROUP BY carrier_name;

-- 2. Actualizar todos los carrier_name a 'Coordinadora'
-- (Ajusta esto según el nombre correcto de tu transportadora principal)
UPDATE codes
SET carrier_name = 'Coordinadora'
WHERE carrier_name IS NOT NULL
  AND carrier_name != 'Coordinadora';

-- 3. Verificar el resultado
SELECT
    carrier_name,
    COUNT(*) as cantidad
FROM codes
WHERE carrier_name IS NOT NULL
GROUP BY carrier_name;

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
