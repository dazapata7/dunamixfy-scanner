-- =====================================================
-- MIGRATION 015: Improve delete_dispatch_for_testing
-- =====================================================
-- Cambia a SECURITY DEFINER para que tenga permisos de eliminar
-- =====================================================

CREATE OR REPLACE FUNCTION delete_dispatch_for_testing(
  p_tracking_code TEXT DEFAULT NULL,
  p_dispatch_number TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  deleted_dispatch_id UUID,
  deleted_shipment_id UUID
) AS $$
DECLARE
  v_dispatch_id UUID;
  v_shipment_record_id UUID;
  v_deleted_items INT := 0;
  v_deleted_movements INT := 0;
  v_deleted_dispatch INT := 0;
  v_deleted_shipment INT := 0;
BEGIN
  -- Buscar dispatch por dispatch_number o guide_code
  IF p_dispatch_number IS NOT NULL THEN
    SELECT id, shipment_record_id INTO v_dispatch_id, v_shipment_record_id
    FROM dispatches
    WHERE dispatch_number = p_dispatch_number
    LIMIT 1;
  ELSIF p_tracking_code IS NOT NULL THEN
    -- Primero buscar directamente en dispatches.guide_code
    SELECT id, shipment_record_id INTO v_dispatch_id, v_shipment_record_id
    FROM dispatches
    WHERE guide_code = p_tracking_code
    LIMIT 1;

    -- Si no se encuentra, buscar en shipment_records.guide_code
    IF v_dispatch_id IS NULL THEN
      SELECT d.id, d.shipment_record_id INTO v_dispatch_id, v_shipment_record_id
      FROM dispatches d
      INNER JOIN shipment_records sr ON sr.id = d.shipment_record_id
      WHERE sr.guide_code = p_tracking_code
      LIMIT 1;
    END IF;
  ELSE
    RETURN QUERY SELECT false, 'Debe proporcionar dispatch_number o tracking_code'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Si no se encuentra el dispatch
  IF v_dispatch_id IS NULL THEN
    RETURN QUERY SELECT false, 'Dispatch no encontrado'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- ✅ ELIMINAR dispatch_items
  DELETE FROM dispatch_items WHERE dispatch_id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- ✅ ELIMINAR inventory_movements relacionados
  DELETE FROM inventory_movements
  WHERE ref_type = 'dispatch' AND ref_id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;

  -- ✅ ELIMINAR dispatch (OBLIGATORIO - no depender de shipment_record)
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
    format('Dispatch eliminado: %s items, %s movimientos, %s dispatches, %s shipments',
      v_deleted_items, v_deleted_movements, v_deleted_dispatch, v_deleted_shipment)::TEXT,
    v_dispatch_id,
    v_shipment_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION delete_dispatch_for_testing IS 'Elimina dispatch y registros relacionados para pruebas (usar solo en desarrollo)';
