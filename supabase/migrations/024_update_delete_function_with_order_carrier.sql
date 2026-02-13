-- =====================================================
-- Migration 024: Actualizar delete_dispatch para copiar order_id y carrier_id
-- =====================================================
-- Actualiza la función delete_dispatch_for_testing para que al crear
-- movimientos de reversión también copie external_order_id y carrier_id
-- desde los movimientos OUT originales
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
  v_dispatch_status TEXT;
  v_deleted_items INT := 0;
  v_deleted_dispatch INT := 0;
  v_deleted_shipment INT := 0;
  v_reverted_items INT := 0;
BEGIN
  -- Buscar dispatch por dispatch_number o guide_code
  IF p_dispatch_number IS NOT NULL THEN
    SELECT id, shipment_record_id, status INTO v_dispatch_id, v_shipment_record_id, v_dispatch_status
    FROM dispatches
    WHERE dispatch_number = p_dispatch_number
    LIMIT 1;
  ELSIF p_tracking_code IS NOT NULL THEN
    -- Primero buscar directamente en dispatches.guide_code
    SELECT id, shipment_record_id, status INTO v_dispatch_id, v_shipment_record_id, v_dispatch_status
    FROM dispatches
    WHERE guide_code = p_tracking_code
    LIMIT 1;

    -- Si no se encuentra, buscar en shipment_records.guide_code
    IF v_dispatch_id IS NULL THEN
      SELECT d.id, d.shipment_record_id, d.status INTO v_dispatch_id, v_shipment_record_id, v_dispatch_status
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
    -- 🔥 NUEVO: Copiar external_order_id y carrier_id desde movimientos OUT originales
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
      im_orig.external_order_id,  -- 🔥 Copiar order_id desde movimiento original
      im_orig.carrier_id,          -- 🔥 Copiar carrier_id desde movimiento original
      im_orig.user_id
    FROM dispatch_items di
    JOIN dispatches d ON d.id = di.dispatch_id
    LEFT JOIN LATERAL (
      -- Buscar el movimiento OUT original para este item
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

    RAISE NOTICE '↩️ Inventario revertido: % items (movimientos IN creados con order_id y carrier_id, OUT originales mantenidos)', v_reverted_items;
  ELSE
    RAISE NOTICE '⊘ Dispatch en estado DRAFT - no se revierte inventario';
  END IF;

  -- ✅ ELIMINAR dispatch_items (metadata, no afecta historial)
  DELETE FROM dispatch_items WHERE dispatch_id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- ✅ ELIMINAR dispatch
  DELETE FROM dispatches WHERE id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_dispatch = ROW_COUNT;

  -- ✅ ELIMINAR shipment_record SOLO SI EXISTE
  IF v_shipment_record_id IS NOT NULL THEN
    DELETE FROM shipment_records WHERE id = v_shipment_record_id;
    GET DIAGNOSTICS v_deleted_shipment = ROW_COUNT;
  END IF;

  -- Retornar resultado exitoso
  RETURN QUERY SELECT
    true,
    format('Dispatch eliminado: %s items, %s dispatches, %s shipments. Inventario revertido: %s items (con order_id y carrier_id)',
      v_deleted_items, v_deleted_dispatch, v_deleted_shipment, v_reverted_items)::TEXT,
    v_dispatch_id,
    v_shipment_record_id,
    v_reverted_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION delete_dispatch_for_testing IS
'Elimina dispatch y revierte inventario creando movimientos IN de reversión.
MANTIENE los movimientos OUT originales para auditoría completa.
Copia external_order_id y carrier_id desde movimientos OUT originales.
Solo revierte si dispatch.status = ''confirmed''.';
