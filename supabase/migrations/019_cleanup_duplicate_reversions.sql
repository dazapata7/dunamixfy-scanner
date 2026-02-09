-- =====================================================
-- MIGRATION 019: Limpiar reversiones duplicadas
-- =====================================================
-- Si se ejecutó 016 ó 017 múltiples veces, habrá movimientos IN duplicados
-- Esta migration elimina los duplicados, manteniendo solo 1 por dispatch
-- =====================================================

-- Para cada dispatch con múltiples movimientos IN de reversión,
-- mantener solo el más reciente
DELETE FROM inventory_movements
WHERE id IN (
  SELECT im.id
  FROM inventory_movements im
  WHERE im.ref_type = 'dispatch'
    AND im.movement_type = 'IN'
    AND im.notes = 'Reversión de dispatch eliminado'
    AND im.id NOT IN (
      -- Mantener el más reciente (created_at DESC, LIMIT 1)
      SELECT MAX(im2.id)
      FROM inventory_movements im2
      WHERE im2.ref_type = 'dispatch'
        AND im2.movement_type = 'IN'
        AND im2.notes = 'Reversión de dispatch eliminado'
        AND im2.ref_id = im.ref_id
        AND im2.product_id = im.product_id
    )
);

-- Log del resultado
DO $$
BEGIN
  RAISE NOTICE '✅ Reversiones duplicadas eliminadas';
  RAISE NOTICE '📊 Sistema de inventario limpio: 1 reversión IN por dispatch+producto';
END $$;
