-- =====================================================
-- Migration 033: Limpiar dispatch vacío DSP-20260313-0995
-- =====================================================
-- Este dispatch fue confirmado accidentalmente sin items.
-- Lo eliminamos usando el RPC existente que maneja todo limpiamente.
-- =====================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  -- Verificar si el dispatch existe
  IF EXISTS (SELECT 1 FROM dispatches WHERE dispatch_number = 'DSP-20260313-0995') THEN

    SELECT * INTO v_result
    FROM delete_dispatch_for_testing(NULL, 'DSP-20260313-0995');

    IF v_result.success THEN
      RAISE NOTICE '✅ Dispatch DSP-20260313-0995 eliminado: %', v_result.message;
    ELSE
      RAISE WARNING '⚠️ No se pudo eliminar DSP-20260313-0995: %', v_result.message;
    END IF;

  ELSE
    RAISE NOTICE '⊘ Dispatch DSP-20260313-0995 no encontrado (ya fue eliminado)';
  END IF;
END;
$$;
