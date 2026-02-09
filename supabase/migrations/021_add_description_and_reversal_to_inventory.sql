-- =====================================================
-- MIGRATION 021: Agregar campo description y ref_type='reversal'
-- =====================================================
-- 1. Agregar columna description a inventory_movements
-- 2. Actualizar constraint de ref_type para incluir 'reversal'
-- =====================================================

-- 1. Agregar columna description (nullable para movimientos existentes)
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN inventory_movements.description IS 'Descripción corta del movimiento (complementa notes)';

-- 2. Eliminar constraint viejo de ref_type
ALTER TABLE inventory_movements
DROP CONSTRAINT IF EXISTS inventory_movements_ref_type_check;

-- 3. Crear constraint nuevo que incluye 'reversal'
ALTER TABLE inventory_movements
ADD CONSTRAINT inventory_movements_ref_type_check
CHECK (ref_type IN ('receipt', 'dispatch', 'adjustment', 'shipment', 'reversal'));

COMMENT ON COLUMN inventory_movements.ref_type IS
'Tipo de documento: receipt, dispatch, adjustment, shipment, reversal (reversión de dispatch eliminado)';

-- =====================================================
-- FIN MIGRATION 021
-- =====================================================
