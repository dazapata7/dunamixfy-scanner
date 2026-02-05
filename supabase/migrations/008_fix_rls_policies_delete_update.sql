-- =====================================================
-- MIGRATION 008: Fix RLS Policies - Enable DELETE and UPDATE
-- =====================================================
-- Fecha: 2026-02-05
-- Propósito: Agregar políticas RLS faltantes para DELETE y UPDATE
--            en tablas warehouses y products
-- =====================================================
-- VERSIÓN 2: Con DROP IF EXISTS para evitar errores de duplicados
-- =====================================================

-- =====================================================
-- WAREHOUSES: Agregar UPDATE y DELETE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON warehouses;
CREATE POLICY "Enable update for all users" ON warehouses
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON warehouses;
CREATE POLICY "Enable delete for all users" ON warehouses
FOR DELETE
USING (true);

-- =====================================================
-- PRODUCTS: Agregar UPDATE y DELETE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON products;
CREATE POLICY "Enable update for all users" ON products
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON products;
CREATE POLICY "Enable delete for all users" ON products
FOR DELETE
USING (true);

-- =====================================================
-- INVENTORY_MOVEMENTS: Agregar UPDATE (por si acaso)
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON inventory_movements;
CREATE POLICY "Enable update for all users" ON inventory_movements
FOR UPDATE
USING (true);

-- =====================================================
-- RECEIPT_ITEMS: Agregar UPDATE y DELETE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON receipt_items;
CREATE POLICY "Enable update for all users" ON receipt_items
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON receipt_items;
CREATE POLICY "Enable delete for all users" ON receipt_items
FOR DELETE
USING (true);

-- =====================================================
-- DISPATCH_ITEMS: Agregar UPDATE y DELETE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON dispatch_items;
CREATE POLICY "Enable update for all users" ON dispatch_items
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON dispatch_items;
CREATE POLICY "Enable delete for all users" ON dispatch_items
FOR DELETE
USING (true);

-- =====================================================
-- SHIPMENT_RECORDS: Agregar UPDATE y DELETE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON shipment_records;
CREATE POLICY "Enable update for all users" ON shipment_records
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON shipment_records;
CREATE POLICY "Enable delete for all users" ON shipment_records
FOR DELETE
USING (true);

-- =====================================================
-- SHIPMENT_ITEMS: Agregar UPDATE y DELETE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON shipment_items;
CREATE POLICY "Enable update for all users" ON shipment_items
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON shipment_items;
CREATE POLICY "Enable delete for all users" ON shipment_items
FOR DELETE
USING (true);

-- =====================================================
-- CSV_IMPORT_BATCHES: Agregar UPDATE
-- =====================================================

DROP POLICY IF EXISTS "Enable update for all users" ON csv_import_batches;
CREATE POLICY "Enable update for all users" ON csv_import_batches
FOR UPDATE
USING (true);

-- =====================================================
-- CSV_IMPORT_ERRORS: No necesita UPDATE/DELETE (solo lectura)
-- =====================================================

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que las políticas se crearon correctamente:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('warehouses', 'products');
-- Deberías ver políticas para: SELECT, INSERT, UPDATE, DELETE

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. Estas políticas permiten acceso total (USING true)
-- 2. En producción, deberías restringir por usuario/rol
-- 3. Ejemplo más seguro:
--    USING (auth.uid() IS NOT NULL) -- Solo usuarios autenticados
-- 4. O por rol:
--    USING (auth.jwt() ->> 'role' = 'admin')
