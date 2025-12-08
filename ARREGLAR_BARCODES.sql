-- ============================================================================
-- SCRIPT SQL: Arreglar lectura de códigos QR y Barcodes
-- ============================================================================
-- Problema 1: Coordinadora requiere min 20 chars pero barcodes tienen 15
-- Problema 2: Interrápidisimo requiere empezar con "24" pero puede variar
-- Solución: Ajustar validation_rules para permitir más flexibilidad
-- ============================================================================

-- 1. VERIFICAR REGLAS ACTUALES
-- ============================================================================
SELECT
  name,
  code,
  validation_rules,
  extraction_config,
  is_active
FROM carriers
ORDER BY name;

-- 2. ARREGLAR COORDINADORA - Permitir códigos más cortos
-- ============================================================================
-- Los barcodes de Coordinadora tienen 15 dígitos (no 20+)
-- Ejemplo: 756813892916001

UPDATE carriers
SET validation_rules = '{
  "pattern": "ends_with_001",
  "min_length": 11
}'::jsonb
WHERE code = 'coordinadora';

-- Esto permite:
-- - Códigos que terminen en "001"
-- - Longitud mínima de 11 caracteres (el código extraído tiene 11)
-- - Tanto QR largos como barcodes cortos

-- 3. ARREGLAR INTERRÁPIDISIMO - Permitir más flexibilidad
-- ============================================================================
-- Esta opción permite cualquier código de 12-13 dígitos numéricos
-- (útil si los barcodes NO empiezan con "24")

UPDATE carriers
SET validation_rules = '{
  "length": [12, 13],
  "digits_only": true
}'::jsonb
WHERE code = 'interrapidisimo';

-- 3. OPCIÓN B: Permitir códigos que empiecen con "24" O "34"
-- ============================================================================
-- Si tus barcodes pueden empezar con diferentes números

-- Primero, verifica que el patrón actual sea "starts_with_24"
-- Luego cámbialo para permitir múltiples inicios:

UPDATE carriers
SET validation_rules = '{
  "length": [12, 13],
  "digits_only": true,
  "pattern": "starts_with_2"
}'::jsonb
WHERE code = 'interrapidisimo';

-- Nota: Esto permitirá códigos que empiecen con "2" (20, 21, 22, ..., 29)

-- 4. OPCIÓN C: Solo permitir longitud específica sin restricción de patrón
-- ============================================================================
-- La más permisiva - útil para debugging

UPDATE carriers
SET validation_rules = '{
  "length": 13,
  "digits_only": true
}'::jsonb
WHERE code = 'interrapidisimo';

-- 5. VERIFICAR CAMBIOS
-- ============================================================================
SELECT
  name,
  validation_rules
FROM carriers
WHERE code = 'interrapidisimo';

-- ============================================================================
-- RECOMENDACIÓN: Ejecuta primero OPCIÓN A
-- ============================================================================
-- La Opción A es la más equilibrada:
-- - Permite longitudes de 12 o 13 dígitos
-- - Solo acepta números
-- - NO requiere que empiece con "24"
--
-- Si con esto funciona, entonces el problema era que tus barcodes
-- no empiezan con "24". Puedes ajustar después según tus códigos reales.
-- ============================================================================
