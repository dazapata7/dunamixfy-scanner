-- =====================================================
-- Migration 026: Limpiar TODA la data de Interrápidisimo
-- =====================================================
-- Elimina batches CSV, shipment_records, shipment_items, dispatches
-- Para hacer reimportación limpia desde cero
-- =====================================================

DO $$
DECLARE
  v_carrier_id UUID;
  v_deleted_batches INT := 0;
  v_deleted_batch_errors INT := 0;
  v_deleted_shipment_items INT := 0;
  v_deleted_shipment_records INT := 0;
  v_deleted_dispatch_items INT := 0;
  v_deleted_dispatches INT := 0;
  v_deleted_movements INT := 0;
BEGIN
  -- Obtener ID de Interrápidisimo
  SELECT id INTO v_carrier_id
  FROM carriers
  WHERE code = 'interrapidisimo'
  LIMIT 1;

  IF v_carrier_id IS NULL THEN
    RAISE NOTICE '⚠️ No se encontró carrier Interrápidisimo';
    RETURN;
  END IF;

  RAISE NOTICE '🗑️ Limpiando data de Interrápidisimo (carrier_id: %)', v_carrier_id;

  -- 1. Eliminar errores de batches CSV
  DELETE FROM csv_import_errors
  WHERE batch_id IN (
    SELECT id FROM csv_import_batches WHERE carrier_id = v_carrier_id
  );
  GET DIAGNOSTICS v_deleted_batch_errors = ROW_COUNT;
  RAISE NOTICE '  - Errores de batches CSV eliminados: %', v_deleted_batch_errors;

  -- 2. Eliminar batches CSV
  DELETE FROM csv_import_batches
  WHERE carrier_id = v_carrier_id;
  GET DIAGNOSTICS v_deleted_batches = ROW_COUNT;
  RAISE NOTICE '  - Batches CSV eliminados: %', v_deleted_batches;

  -- 3. Eliminar movimientos de inventario relacionados a dispatches de Interrápidisimo
  DELETE FROM inventory_movements
  WHERE carrier_id = v_carrier_id;
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;
  RAISE NOTICE '  - Movimientos de inventario eliminados: %', v_deleted_movements;

  -- 4. Eliminar dispatch_items de dispatches de Interrápidisimo
  DELETE FROM dispatch_items
  WHERE dispatch_id IN (
    SELECT id FROM dispatches WHERE carrier_id = v_carrier_id
  );
  GET DIAGNOSTICS v_deleted_dispatch_items = ROW_COUNT;
  RAISE NOTICE '  - Dispatch items eliminados: %', v_deleted_dispatch_items;

  -- 5. Eliminar dispatches de Interrápidisimo
  DELETE FROM dispatches
  WHERE carrier_id = v_carrier_id;
  GET DIAGNOSTICS v_deleted_dispatches = ROW_COUNT;
  RAISE NOTICE '  - Dispatches eliminados: %', v_deleted_dispatches;

  -- 6. Eliminar shipment_items de Interrápidisimo
  DELETE FROM shipment_items
  WHERE shipment_record_id IN (
    SELECT id FROM shipment_records WHERE carrier_id = v_carrier_id
  );
  GET DIAGNOSTICS v_deleted_shipment_items = ROW_COUNT;
  RAISE NOTICE '  - Shipment items eliminados: %', v_deleted_shipment_items;

  -- 7. Eliminar shipment_records de Interrápidisimo
  DELETE FROM shipment_records
  WHERE carrier_id = v_carrier_id;
  GET DIAGNOSTICS v_deleted_shipment_records = ROW_COUNT;
  RAISE NOTICE '  - Shipment records eliminados: %', v_deleted_shipment_records;

  RAISE NOTICE '✅ Limpieza completada. Total eliminado:';
  RAISE NOTICE '   Batches CSV: %, Errores: %', v_deleted_batches, v_deleted_batch_errors;
  RAISE NOTICE '   Shipment records: %, Items: %', v_deleted_shipment_records, v_deleted_shipment_items;
  RAISE NOTICE '   Dispatches: %, Items: %', v_deleted_dispatches, v_deleted_dispatch_items;
  RAISE NOTICE '   Movimientos inventario: %', v_deleted_movements;
END $$;
