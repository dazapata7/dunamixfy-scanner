-- =====================================================
-- MIGRATION 013: Función para Eliminar Dispatch (Testing)
-- =====================================================
-- Permite eliminar dispatches para pruebas
-- Elimina en cascada: dispatch_items, inventory_movements, shipment_records
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
  v_deleted_items INT;
  v_deleted_movements INT;
BEGIN
  -- Buscar dispatch por dispatch_number o tracking_code
  IF p_dispatch_number IS NOT NULL THEN
    SELECT id, shipment_record_id INTO v_dispatch_id, v_shipment_record_id
    FROM dispatches
    WHERE dispatch_number = p_dispatch_number
    LIMIT 1;
  ELSIF p_tracking_code IS NOT NULL THEN
    SELECT d.id, d.shipment_record_id INTO v_dispatch_id, v_shipment_record_id
    FROM dispatches d
    INNER JOIN shipment_records sr ON sr.id = d.shipment_record_id
    WHERE sr.tracking_code = p_tracking_code
    LIMIT 1;
  ELSE
    RETURN QUERY SELECT false, 'Debe proporcionar dispatch_number o tracking_code'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Si no se encuentra el dispatch
  IF v_dispatch_id IS NULL THEN
    RETURN QUERY SELECT false, 'Dispatch no encontrado'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Eliminar dispatch_items
  DELETE FROM dispatch_items WHERE dispatch_id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- Eliminar inventory_movements relacionados
  DELETE FROM inventory_movements
  WHERE ref_type = 'dispatch' AND ref_id = v_dispatch_id;
  GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;

  -- Eliminar dispatch
  DELETE FROM dispatches WHERE id = v_dispatch_id;

  -- Eliminar shipment_record
  IF v_shipment_record_id IS NOT NULL THEN
    DELETE FROM shipment_records WHERE id = v_shipment_record_id;
  END IF;

  -- Retornar resultado exitoso
  RETURN QUERY SELECT
    true,
    format('Dispatch eliminado: %s items, %s movimientos', v_deleted_items, v_deleted_movements)::TEXT,
    v_dispatch_id,
    v_shipment_record_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Comentario
COMMENT ON FUNCTION delete_dispatch_for_testing IS 'Elimina dispatch y registros relacionados para pruebas (usar solo en desarrollo)';

-- =====================================================
-- EJEMPLO DE USO
-- =====================================================
-- Por número de dispatch:
-- SELECT * FROM delete_dispatch_for_testing(p_dispatch_number := 'DSP-20260206-001');

-- Por número de guía:
-- SELECT * FROM delete_dispatch_for_testing(p_tracking_code := '56813980306');
