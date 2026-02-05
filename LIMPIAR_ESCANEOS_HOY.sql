-- =====================================================
-- SCRIPT: Limpiar escaneos de hoy (tabla codes)
-- =====================================================
-- Fecha: 2026-02-05
-- Propósito: Borrar escaneos de hoy para empezar limpio con WMS
-- =====================================================

-- ⚠️ ADVERTENCIA: Este script borrará TODOS los escaneos de hoy
-- Solo ejecutar si estás seguro de querer borrar los datos

-- 1. Ver cuántos escaneos de hoy hay (VERIFICACIÓN)
SELECT COUNT(*) as total_escaneos_hoy
FROM codes
WHERE created_at::date = CURRENT_DATE;

-- 2. Ver detalle de escaneos de hoy (VERIFICACIÓN)
SELECT
  id,
  code,
  carrier_name,
  store_name,
  customer_name,
  created_at
FROM codes
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;

-- =====================================================
-- IMPORTANTE: Solo ejecutar el DELETE si estás seguro
-- =====================================================

-- 3. BORRAR escaneos de hoy (CUIDADO: IRREVERSIBLE)
-- Descomenta la siguiente línea para ejecutar:

-- DELETE FROM codes
-- WHERE created_at::date = CURRENT_DATE;

-- 4. Verificar que se borraron (después de ejecutar DELETE)
-- SELECT COUNT(*) FROM codes WHERE created_at::date = CURRENT_DATE;
-- Debería retornar 0

-- =====================================================
-- ALTERNATIVA: Borrar escaneos de las últimas 24 horas
-- =====================================================

-- Si prefieres borrar solo las últimas 24 horas:
-- DELETE FROM codes
-- WHERE created_at >= NOW() - INTERVAL '24 hours';

-- =====================================================
-- ALTERNATIVA 2: Borrar solo escaneos de Coordinadora de hoy
-- =====================================================

-- Si quieres borrar solo los de Coordinadora:
-- DELETE FROM codes
-- WHERE created_at::date = CURRENT_DATE
--   AND carrier_name ILIKE '%coordinadora%';

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Este script solo afecta la tabla 'codes' (scanner DMX5)
-- 2. NO afecta la tabla 'dispatches' (WMS)
-- 3. NO afecta inventario
-- 4. Las estadísticas del Dashboard se actualizarán automáticamente
-- 5. El historial WMS no se ve afectado (porque esos escaneos nunca crearon dispatches)

-- =====================================================
-- RECOMENDACIÓN DESPUÉS DE BORRAR:
-- =====================================================
-- 1. Verificar que COUNT = 0
-- 2. Refrescar Dashboard (debería mostrar 0 escaneos hoy)
-- 3. Empezar a escanear con WMS unificado
-- 4. Todos los escaneos futuros crearán dispatches automáticamente
