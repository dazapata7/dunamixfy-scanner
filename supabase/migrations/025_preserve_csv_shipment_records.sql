-- =====================================================
-- Migration 025: Preservar shipment_records de CSV al borrar dispatch
-- =====================================================
-- FIX CRÍTICO: NO eliminar shipment_records que vienen de CSV
-- Solo eliminar shipment_records que vienen de API (Coordinadora)
-- Para CSV: resetear status a 'READY' para permitir re-escaneo
-- =====================================================

DROP FUNCTION IF EXISTS delete_dispatch_for_testing(TEXT, TEXT);

CREATE OR REPLACE FUNCTION delete_dispatch_for_testing(
  p_tracking_code TEXT DEFAULT NULL,
  p_dispatch_number TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  deleted_dispatch_id UUID,
  deleted_shipment_id UUID,
  reverted_items INT
) AS $$
DECLARE
  v_dispatch_id UUID;
  v_shipment_record_id UUID;
  v_shipment_source TEXT;
  v_dispatch_status TEXT;
  v_deleted_items INT := 0;
  v_deleted_dispatch INT := 0;
  v_deleted_shipment INT := 0;
  v_reverted_items INT := 0;
BEGIN
  -- Buscar dispatch por dispatch_number o guide_code
  IF p_dispatch_number IS NOT NULL THEN
    SELECT d.id, d.shipment_record_id, d.status, sr.source
    INTO v_dispatch_id, v_shipment_record_id, v_dispatch_status, v_shipment_source
    FROM dispatches d
    LEFT JOIN shipment_records sr ON sr.id = d.shipment_record_id
    WHERE d.dispatch_number = p_dispatch_number
    LIMIT 1;
  ELSIF p_tracking_code IS NOT NULL THEN
    -- Primero buscar directamente en dispatches.guide_code
    SELECT d.id, d.shipment_record_id, d.status, sr.source
    INTO v_dispatch_id, v_shipment_record_id, v_dispatch_status, v_shipment_source
    FROM dispatches d
    LEFT JOIN shipment_records sr ON sr.id = d.shipment_record_id
    WHERE d.guide_code = p_tracking_code
    LIMIT 1;

    -- Si no se encuentra, buscar en shipment_records.guide_code
    IF v_dispatch_id IS NULL THEN
      SELECT d.id, d.shipment_record_id, d.status, sr.source
      INTO v_dispatch_id, v_shipment_record_id, v_dispatch_status, v_shipment_source
      FROM dispatches d
      INNER JOIN shipment_records sr ON sr.id = d.shipment_record_id
      WHERE sr.guide_code = p_tracking_code
      LIMIT 1;
    END IF;
  ELSE
    RETURN QUERY SELECT false, 'Debe proporcionar dispatch_number o tracking_code'::TEXT, NULL::UUID, NULL::UUID, 0;
    RETURN;
  END IF;

  -- Si no se encuentra el dispatch
  IF v_dispatch_id IS NULL THEN
    RETURN QUERY SELECT false, 'Dispatch no encontrado'::TEXT, NULL::UUID, NULL::UUID, 0;
    RETURN;
  END IF;

  -- ✅ REVERTIR INVENTARIO SOLO SI DISPATCH ESTÁ CONFIRMED
  IF v_dispatch_status = 'confirmed' THEN
    -- Crear movimientos IN inversos para cada dispatch_item
    INSERT INTO inventory_movements (
      movement_type,
      qty_signed,
      warehouse_id,
      product_id,
      ref_type,
      ref_id,
      description,
      notes,
      external_order_id,
      carrier_id,
      user_id
    )
    SELECT
      'IN'::TEXT,
      di.qty,
      d.warehouse_id,
      di.product_id,
      'reversal'::TEXT,
      v_dispatch_id,
      'Reversión de dispatch ' || d.dispatch_number::TEXT,
      'Dispatch cancelado - inventario revertido'::TEXT,
      im_orig.external_order_id,
      im_orig.carrier_id,
      im_orig.user_id
    FROM dispatch_items di
    JOIN dispatches d ON d.id = di.dispatch_id
    LEFT JOIN LATERAL (
      SELECT external_order_id, carrier_id, user_id
      FROM inventory_movements
      WHERE ref_type = 'dispatch'
        AND ref_id = v_dispatch_id
        AND product_id = di.product_id
        AND movement_type = 'OUT'
      LIMIT 1
    ) im_orig ON true
    WHERE di.dispatch_id = v_dispatch_id;

    GET DIAGNOSTICS v_reverted_items = ROW_COUNT;

    RAISE NOTICE '↩️ Inventario revertido: % items', v_reverted_items;
  ELSE
    RAISE NOTICE '⊘ Dispatch en estado DRAFT - no se revierte inventario';
  END IF;

  -- ✅ ELIMINAR dispatch_items
  DELETE FROM dispatch_items WHERE dispatch_id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- ✅ ELIMINAR dispatch
  DELETE FROM dispatches WHERE id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_dispatch = ROW_COUNT;

  -- 🔥 NUEVA LÓGICA: shipment_record según source
  IF v_shipment_record_id IS NOT NULL THEN
    IF v_shipment_source = 'CSV' THEN
      -- ✅ CSV: NO ELIMINAR, solo resetear status a READY
      UPDATE shipment_records
      SET status = 'READY'
      WHERE id = v_shipment_record_id;

      RAISE NOTICE '📝 Shipment record de CSV preservado (status → READY)';
      v_deleted_shipment := 0; -- No se eliminó
    ELSE
      -- ✅ API: ELIMINAR (Coordinadora se crea al escanear, se puede recrear)
      DELETE FROM shipment_records WHERE id = v_shipment_record_id;
      GET DIAGNOSTICS v_deleted_shipment = ROW_COUNT;

      RAISE NOTICE '🗑️ Shipment record de API eliminado';
    END IF;
  END IF;

  -- Retornar resultado
  RETURN QUERY SELECT
    true,
    format('Dispatch eliminado: %s items, %s dispatches, %s shipments %s. Inventario revertido: %s items',
      v_deleted_items,
      v_deleted_dispatch,
      v_deleted_shipment,
      CASE WHEN v_shipment_source = 'CSV' THEN '(CSV preservado)' ELSE '(API eliminado)' END,
      v_reverted_items)::TEXT,
    v_dispatch_id,
    CASE WHEN v_deleted_shipment > 0 THEN v_shipment_record_id ELSE NULL END, -- Solo si se eliminó
    v_reverted_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION delete_dispatch_for_testing IS
'Elimina dispatch y revierte inventario creando movimientos IN de reversión.
PRESERVA shipment_records de CSV (resetea status a READY para re-escaneo).
ELIMINA shipment_records de API (Coordinadora, se recrean al escanear).
Copia external_order_id y carrier_id a movimientos de reversión.';
