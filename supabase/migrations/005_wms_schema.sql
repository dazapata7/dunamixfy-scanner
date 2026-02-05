-- =====================================================
-- DUNAMIX WMS - FASE 1: SCHEMA COMPLETO
-- =====================================================
-- Warehouse Management System integrado con Scanner DMX5
-- Fecha: 2026-02-04
-- Versión: 1.0.0
-- =====================================================

-- =====================================================
-- TABLA 1: warehouses (Almacenes)
-- =====================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses(is_active);

-- Comentarios
COMMENT ON TABLE warehouses IS 'Almacenes/bodegas donde se gestiona el inventario';
COMMENT ON COLUMN warehouses.code IS 'Código único del almacén (ej: BOG-001, MED-001)';

-- =====================================================
-- TABLA 2: products (Productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Comentarios
COMMENT ON TABLE products IS 'Catálogo de productos del sistema WMS';
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - identificador único del producto';
COMMENT ON COLUMN products.barcode IS 'Código de barras del producto (opcional)';

-- =====================================================
-- TABLA 3: inventory_movements (Ledger de Movimientos)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
  qty_signed INTEGER NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  ref_type TEXT CHECK (ref_type IN ('receipt', 'dispatch', 'adjustment', 'shipment')),
  ref_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para inventory_movements
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(ref_type, ref_id);

-- Comentarios
COMMENT ON TABLE inventory_movements IS 'Ledger de movimientos de inventario (base para cálculo de stock)';
COMMENT ON COLUMN inventory_movements.movement_type IS 'Tipo de movimiento: IN (entrada), OUT (salida), ADJUST (ajuste)';
COMMENT ON COLUMN inventory_movements.qty_signed IS 'Cantidad con signo: positivo para IN, negativo para OUT';
COMMENT ON COLUMN inventory_movements.ref_type IS 'Tipo de documento que generó el movimiento';
COMMENT ON COLUMN inventory_movements.ref_id IS 'ID del documento de referencia';

-- =====================================================
-- TABLA 4: receipts (Entradas de Inventario)
-- =====================================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'confirmed')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para receipts
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_warehouse ON receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);

-- Comentarios
COMMENT ON TABLE receipts IS 'Documentos de entrada de inventario';
COMMENT ON COLUMN receipts.receipt_number IS 'Número único auto-generado (ej: RCP-20260204-001)';
COMMENT ON COLUMN receipts.status IS 'Estado: draft (borrador), confirmed (confirmado y movimientos creados)';

-- =====================================================
-- TABLA 5: receipt_items (Items de Entrada)
-- =====================================================
CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  notes TEXT
);

-- Índices para receipt_items
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_product ON receipt_items(product_id);

-- Comentarios
COMMENT ON TABLE receipt_items IS 'Items/líneas de las entradas de inventario';

-- =====================================================
-- TABLA 6: dispatches (Salidas de Inventario)
-- =====================================================
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number TEXT UNIQUE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL,
  guide_code TEXT UNIQUE,
  status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'confirmed', 'shipped')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para dispatches
CREATE INDEX IF NOT EXISTS idx_dispatches_number ON dispatches(dispatch_number);
CREATE INDEX IF NOT EXISTS idx_dispatches_warehouse ON dispatches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_guide_code ON dispatches(guide_code) WHERE guide_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatches_carrier ON dispatches(carrier_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at DESC);

-- Comentarios
COMMENT ON TABLE dispatches IS 'Documentos de salida de inventario (despachos)';
COMMENT ON COLUMN dispatches.dispatch_number IS 'Número único auto-generado (ej: DSP-20260204-001)';
COMMENT ON COLUMN dispatches.guide_code IS 'Código de guía de la transportadora (si aplica)';
COMMENT ON COLUMN dispatches.status IS 'Estado: draft, confirmed (confirmado con movimientos), shipped (enviado)';

-- =====================================================
-- TABLA 7: dispatch_items (Items de Salida)
-- =====================================================
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  notes TEXT
);

-- Índices para dispatch_items
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_product ON dispatch_items(product_id);

-- Comentarios
COMMENT ON TABLE dispatch_items IS 'Items/líneas de las salidas de inventario';

-- =====================================================
-- TABLA 8: shipment_records (Envíos - Origen de Datos)
-- =====================================================
CREATE TABLE IF NOT EXISTS shipment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
  guide_code TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('API', 'CSV')),
  status TEXT DEFAULT 'READY' NOT NULL CHECK (status IN ('READY', 'PROCESSED', 'ERROR')),
  raw_payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para shipment_records
CREATE INDEX IF NOT EXISTS idx_shipment_records_guide_code ON shipment_records(guide_code);
CREATE INDEX IF NOT EXISTS idx_shipment_records_carrier ON shipment_records(carrier_id);
CREATE INDEX IF NOT EXISTS idx_shipment_records_status ON shipment_records(status);
CREATE INDEX IF NOT EXISTS idx_shipment_records_source ON shipment_records(source);

-- Comentarios
COMMENT ON TABLE shipment_records IS 'Registro de envíos con items - origen de datos para dispatches';
COMMENT ON COLUMN shipment_records.source IS 'Origen de los datos: API (Coordinadora) o CSV (Interrápidisimo)';
COMMENT ON COLUMN shipment_records.status IS 'READY (listo para procesar), PROCESSED (ya despachado), ERROR (con problemas)';
COMMENT ON COLUMN shipment_records.raw_payload IS 'Datos completos originales de API o CSV';

-- =====================================================
-- TABLA 9: shipment_items (Items del Envío)
-- =====================================================
CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_record_id UUID NOT NULL REFERENCES shipment_records(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL
);

-- Índices para shipment_items
CREATE INDEX IF NOT EXISTS idx_shipment_items_record ON shipment_items(shipment_record_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_sku ON shipment_items(sku);
CREATE INDEX IF NOT EXISTS idx_shipment_items_product ON shipment_items(product_id) WHERE product_id IS NOT NULL;

-- Comentarios
COMMENT ON TABLE shipment_items IS 'Items/productos del envío (puede existir SKU que aún no esté en products)';
COMMENT ON COLUMN shipment_items.product_id IS 'Relación con producto (nullable - se mapea al procesar)';

-- =====================================================
-- TABLA 10: csv_import_batches (Auditoría de Importaciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS csv_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  total_rows INTEGER DEFAULT 0 NOT NULL,
  success_count INTEGER DEFAULT 0 NOT NULL,
  error_count INTEGER DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'processing' NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para csv_import_batches
CREATE INDEX IF NOT EXISTS idx_csv_import_batches_carrier ON csv_import_batches(carrier_id);
CREATE INDEX IF NOT EXISTS idx_csv_import_batches_operator ON csv_import_batches(operator_id);
CREATE INDEX IF NOT EXISTS idx_csv_import_batches_created_at ON csv_import_batches(created_at DESC);

-- Comentarios
COMMENT ON TABLE csv_import_batches IS 'Auditoría de importaciones CSV (trazabilidad)';

-- =====================================================
-- TABLA 11: csv_import_errors (Errores de Importación)
-- =====================================================
CREATE TABLE IF NOT EXISTS csv_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES csv_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  error_message TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para csv_import_errors
CREATE INDEX IF NOT EXISTS idx_csv_import_errors_batch ON csv_import_errors(batch_id);

-- Comentarios
COMMENT ON TABLE csv_import_errors IS 'Errores ocurridos durante importación CSV (para feedback al usuario)';

-- =====================================================
-- VISTA: inventory_stock_view (Stock Actual)
-- =====================================================
CREATE OR REPLACE VIEW inventory_stock_view AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  p.barcode,
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  COALESCE(SUM(im.qty_signed), 0) AS qty_on_hand
FROM products p
CROSS JOIN warehouses w
LEFT JOIN inventory_movements im
  ON im.product_id = p.id
  AND im.warehouse_id = w.id
WHERE p.is_active = true
  AND w.is_active = true
GROUP BY p.id, p.sku, p.name, p.barcode, w.id, w.code, w.name
ORDER BY p.sku, w.code;

-- Comentarios
COMMENT ON VIEW inventory_stock_view IS 'Vista de stock actual por producto y almacén (calculado desde movimientos)';

-- =====================================================
-- TRIGGERS: Auto-update updated_at
-- =====================================================

-- Trigger para warehouses
CREATE OR REPLACE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para products
CREATE OR REPLACE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para receipts
CREATE OR REPLACE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para dispatches
CREATE OR REPLACE TRIGGER update_dispatches_updated_at
  BEFORE UPDATE ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para shipment_records
CREATE OR REPLACE TRIGGER update_shipment_records_updated_at
  BEFORE UPDATE ON shipment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para csv_import_batches
CREATE OR REPLACE TRIGGER update_csv_import_batches_updated_at
  BEFORE UPDATE ON csv_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (Row Level Security) POLICIES
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_errors ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (Fase 1 - simplificado)
-- En producción, agregar políticas basadas en roles

-- warehouses
CREATE POLICY "Enable read access for all users" ON warehouses FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON warehouses FOR INSERT WITH CHECK (true);

-- products
CREATE POLICY "Enable read access for all users" ON products FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON products FOR INSERT WITH CHECK (true);

-- inventory_movements
CREATE POLICY "Enable read access for all users" ON inventory_movements FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON inventory_movements FOR INSERT WITH CHECK (true);

-- receipts
CREATE POLICY "Enable read access for all users" ON receipts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON receipts FOR UPDATE USING (true);

-- receipt_items
CREATE POLICY "Enable read access for all users" ON receipt_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON receipt_items FOR INSERT WITH CHECK (true);

-- dispatches
CREATE POLICY "Enable read access for all users" ON dispatches FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON dispatches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON dispatches FOR UPDATE USING (true);

-- dispatch_items
CREATE POLICY "Enable read access for all users" ON dispatch_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON dispatch_items FOR INSERT WITH CHECK (true);

-- shipment_records
CREATE POLICY "Enable read access for all users" ON shipment_records FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON shipment_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON shipment_records FOR UPDATE USING (true);

-- shipment_items
CREATE POLICY "Enable read access for all users" ON shipment_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON shipment_items FOR INSERT WITH CHECK (true);

-- csv_import_batches
CREATE POLICY "Enable read access for all users" ON csv_import_batches FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON csv_import_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON csv_import_batches FOR UPDATE USING (true);

-- csv_import_errors
CREATE POLICY "Enable read access for all users" ON csv_import_errors FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON csv_import_errors FOR INSERT WITH CHECK (true);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para generar número de recibo (RCP-YYYYMMDD-###)
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  sequence_num INTEGER;
  receipt_num TEXT;
BEGIN
  date_part := to_char(CURRENT_DATE, 'YYYYMMDD');

  -- Contar recibos del día
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM receipts
  WHERE receipt_number LIKE 'RCP-' || date_part || '-%';

  receipt_num := 'RCP-' || date_part || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN receipt_num;
END;
$$ LANGUAGE plpgsql;

-- Función para generar número de despacho (DSP-YYYYMMDD-###)
CREATE OR REPLACE FUNCTION generate_dispatch_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  sequence_num INTEGER;
  dispatch_num TEXT;
BEGIN
  date_part := to_char(CURRENT_DATE, 'YYYYMMDD');

  -- Contar despachos del día
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM dispatches
  WHERE dispatch_number LIKE 'DSP-' || date_part || '-%';

  dispatch_num := 'DSP-' || date_part || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN dispatch_num;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON FUNCTION generate_receipt_number() IS 'Genera número único de recibo (RCP-20260204-001)';
COMMENT ON FUNCTION generate_dispatch_number() IS 'Genera número único de despacho (DSP-20260204-001)';

-- =====================================================
-- DATOS DE PRUEBA (Warehouse y Productos)
-- =====================================================

-- Insertar almacén de prueba
INSERT INTO warehouses (code, name, address, is_active)
VALUES
  ('BOG-001', 'Bodega Principal Bogotá', 'Calle 100 #15-20, Bogotá, Colombia', true),
  ('MED-001', 'Bodega Medellín', 'Carrera 43A #1-50, Medellín, Colombia', true)
ON CONFLICT (code) DO NOTHING;

-- Insertar productos de prueba (Rodillax y Lumbrax)
INSERT INTO products (sku, name, barcode, description, is_active)
VALUES
  ('RODILLAX-50ML', 'Rodillax Gel 50ml', '7701234567891', 'Gel para alivio del dolor articular y muscular - 50ml', true),
  ('RODILLAX-100ML', 'Rodillax Gel 100ml', '7701234567892', 'Gel para alivio del dolor articular y muscular - 100ml', true),
  ('LUMBRAX-50ML', 'Lumbrax Gel 50ml', '7701234567893', 'Gel para dolor lumbar y de espalda - 50ml', true),
  ('LUMBRAX-100ML', 'Lumbrax Gel 100ml', '7701234567894', 'Gel para dolor lumbar y de espalda - 100ml', true),
  ('COMBO-RODILLAX-LUMBRAX', 'Combo Rodillax + Lumbrax', '7701234567895', 'Pack combo Rodillax 50ml + Lumbrax 50ml', true)
ON CONFLICT (sku) DO NOTHING;

-- =====================================================
-- FIN DEL SCHEMA WMS FASE 1
-- =====================================================
