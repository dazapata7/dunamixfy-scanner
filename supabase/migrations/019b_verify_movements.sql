-- =====================================================
-- VERIFICACIÓN: Ver todos los movimientos del dispatch eliminado
-- =====================================================
-- Ejecuta esta query para ver qué movimientos hay

-- Primero, encontrar despachos eliminados recientemente
SELECT
  'DESPACHOS ELIMINADOS (últimas 24h)' as tipo,
  NULL::UUID as id,
  NULL::UUID as product_id,
  NULL::TEXT as product_name,
  NULL::TEXT as movement_type,
  NULL::INTEGER as qty_signed
ORDER BY 1;

-- Ver movimientos de ese dispatch en inventory_movements
-- (aunque el dispatch esté eliminado, los movimientos persisten en ref_id)
SELECT
  'MOVIMIENTOS RESTANTES' as tipo,
  im.id,
  im.product_id,
  p.name as product_name,
  im.movement_type,
  im.qty_signed
FROM inventory_movements im
JOIN products p ON p.id = im.product_id
WHERE im.ref_type = 'dispatch'
  AND im.notes LIKE '%Reversión%'
  AND im.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY im.created_at DESC, im.product_id;

-- Contar movimientos IN duplicados por dispatch
SELECT
  im.ref_id as dispatch_id,
  im.product_id,
  p.name as product_name,
  COUNT(*) as cantidad_movimientos_in,
  STRING_AGG(im.id::TEXT, ', ') as movement_ids
FROM inventory_movements im
JOIN products p ON p.id = im.product_id
WHERE im.ref_type = 'dispatch'
  AND im.movement_type = 'IN'
  AND im.notes = 'Reversión de dispatch eliminado'
GROUP BY im.ref_id, im.product_id, p.name
HAVING COUNT(*) > 1
ORDER BY im.ref_id;
