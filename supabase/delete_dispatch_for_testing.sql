-- =====================================================
-- ELIMINAR DISPATCH PARA PRUEBAS
-- =====================================================
-- Guía: 56813980306
-- Dispatch: DSP-20260206-001
-- =====================================================

-- 1. Buscar el dispatch y sus datos relacionados
DO $$
DECLARE
  v_dispatch_id UUID;
  v_shipment_record_id UUID;
BEGIN
  -- Buscar el dispatch por número o por guía
  SELECT id, shipment_record_id INTO v_dispatch_id, v_shipment_record_id
  FROM dispatches
  WHERE dispatch_number = 'DSP-20260206-001'
  LIMIT 1;

  IF v_dispatch_id IS NULL THEN
    -- Buscar por número de guía en shipment_records
    SELECT d.id, d.shipment_record_id INTO v_dispatch_id, v_shipment_record_id
    FROM dispatches d
    INNER JOIN shipment_records sr ON sr.id = d.shipment_record_id
    WHERE sr.tracking_code = '56813980306'
    LIMIT 1;
  END IF;

  IF v_dispatch_id IS NOT NULL THEN
    RAISE NOTICE '🔍 Dispatch encontrado: %', v_dispatch_id;

    -- 2. Eliminar dispatch_items (hijos primero)
    DELETE FROM dispatch_items WHERE dispatch_id = v_dispatch_id;
    RAISE NOTICE '✅ dispatch_items eliminados';

    -- 3. Eliminar inventory_movements relacionados (si hay)
    DELETE FROM inventory_movements
    WHERE ref_type = 'dispatch' AND ref_id = v_dispatch_id;
    RAISE NOTICE '✅ inventory_movements eliminados';

    -- 4. Eliminar dispatch
    DELETE FROM dispatches WHERE id = v_dispatch_id;
    RAISE NOTICE '✅ dispatch eliminado';

    -- 5. Eliminar shipment_record
    IF v_shipment_record_id IS NOT NULL THEN
      DELETE FROM shipment_records WHERE id = v_shipment_record_id;
      RAISE NOTICE '✅ shipment_record eliminado';
    END IF;

    RAISE NOTICE '🎉 Dispatch DSP-20260206-001 eliminado completamente';
  ELSE
    RAISE NOTICE '⚠️ No se encontró el dispatch DSP-20260206-001 o guía 56813980306';
  END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que no exista el dispatch
SELECT
  'Dispatches con ese número:' as check_type,
  COUNT(*) as count
FROM dispatches
WHERE dispatch_number = 'DSP-20260206-001';

-- Verificar que no exista la guía en shipment_records
SELECT
  'Guías con ese tracking_code:' as check_type,
  COUNT(*) as count
FROM shipment_records
WHERE tracking_code = '56813980306';
