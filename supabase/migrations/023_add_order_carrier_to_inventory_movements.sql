-- =====================================================
-- Migration 023: Agregar order_id y carrier_id a inventory_movements
-- =====================================================
-- Agregar rastreabilidad de orden y transportadora a movimientos de inventario
-- Permite saber de qué orden específica y transportadora viene cada movimiento
-- =====================================================

-- Agregar columnas order_id y carrier_id
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS external_order_id TEXT,
ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL;

-- Comentarios
COMMENT ON COLUMN inventory_movements.external_order_id IS 'ID de la orden externa (Dunamixfy, Interrápidisimo, etc.)';
COMMENT ON COLUMN inventory_movements.carrier_id IS 'Transportadora asociada al movimiento (para dispatches)';

-- Crear índice para búsquedas por orden
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON inventory_movements(external_order_id);

-- Crear índice para búsquedas por carrier
CREATE INDEX IF NOT EXISTS idx_inventory_movements_carrier ON inventory_movements(carrier_id);

-- Comentario actualizado de la tabla
COMMENT ON TABLE inventory_movements IS 'Ledger de movimientos de inventario con rastreabilidad de orden y transportadora';
