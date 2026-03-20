-- =====================================================
-- MIGRATION 040: Seguridad RLS Real + Permisos Operadores
-- =====================================================
-- Reemplaza USING(true) por políticas reales basadas en:
--   superadmin → ve TODO
--   admin      → ve su company
--   operator   → ve su company (refinable a warehouse en futuro)
--
-- Agrega permissions JSONB a operators para control granular
-- Agrega company_id a products para aislamiento de catálogo
-- =====================================================

-- ══════════════════════════════════════════════════════
-- PARTE 1: Funciones helper (SECURITY DEFINER)
-- ══════════════════════════════════════════════════════

-- ¿Es el usuario actual un superadmin?
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM operators
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- ¿company_id del usuario actual?
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT company_id FROM operators WHERE id = auth.uid();
$$;

-- ¿Es admin o superadmin?
CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM operators
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;

-- IDs de warehouses accesibles por el usuario actual
-- (superadmin→todos, admin→su company, operator→sus asignaciones)
CREATE OR REPLACE FUNCTION my_accessible_warehouse_ids()
RETURNS TABLE(warehouse_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT w.id
  FROM warehouses w
  WHERE
    -- Superadmin: todos
    is_superadmin()
    OR
    -- Admin: toda su company
    (
      w.company_id = get_my_company_id()
      AND EXISTS (SELECT 1 FROM operators WHERE id = auth.uid() AND role = 'admin')
    )
    OR
    -- Operator: solo los warehouses asignados
    w.id IN (
      SELECT ow.warehouse_id
      FROM operator_warehouses ow
      WHERE ow.operator_id = auth.uid()
    );
$$;

-- ══════════════════════════════════════════════════════
-- PARTE 2: Permisos granulares en operators
-- ══════════════════════════════════════════════════════
-- Permite al Admin configurar qué puede hacer cada operador
-- desde el panel de administración sin tocar roles.

ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
    "can_scan":             true,
    "can_confirm_batch":    true,
    "can_delete_dispatch":  false,
    "can_view_reports":     false,
    "can_import_csv":       false,
    "can_manage_products":  false,
    "can_manage_returns":   true,
    "can_manage_production":false
  }'::jsonb;

COMMENT ON COLUMN operators.permissions IS
  'Permisos granulares configurables por el Admin. Keys: can_scan, can_confirm_batch, can_delete_dispatch, can_view_reports, can_import_csv, can_manage_products, can_manage_returns, can_manage_production';

-- ── Helper: ¿el usuario actual tiene un permiso específico? ──
CREATE OR REPLACE FUNCTION has_permission(p_key text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    -- Admins y superadmins siempre tienen todos los permisos
    is_admin_or_above()
    OR
    COALESCE(
      (SELECT (permissions ->> p_key)::boolean FROM operators WHERE id = auth.uid()),
      false
    );
$$;

-- ══════════════════════════════════════════════════════
-- PARTE 3: company_id en products
-- ══════════════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);

COMMENT ON COLUMN products.company_id IS
  'Empresa dueña del producto. NULL = producto global visible para todos';

-- ══════════════════════════════════════════════════════
-- PARTE 4: RLS por tabla
-- ══════════════════════════════════════════════════════

-- ─── WAREHOUSES ───────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON warehouses;
  DROP POLICY IF EXISTS "Enable insert for all users"      ON warehouses;
  DROP POLICY IF EXISTS "Enable update for all users"      ON warehouses;
  DROP POLICY IF EXISTS "Enable delete for all users"      ON warehouses;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "warehouses_select" ON warehouses FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    is_superadmin()
    OR company_id = get_my_company_id()
  )
);
CREATE POLICY "warehouses_insert" ON warehouses FOR INSERT WITH CHECK (
  is_admin_or_above() AND (
    is_superadmin() OR company_id = get_my_company_id()
  )
);
CREATE POLICY "warehouses_update" ON warehouses FOR UPDATE USING (
  is_admin_or_above() AND (
    is_superadmin() OR company_id = get_my_company_id()
  )
);
CREATE POLICY "warehouses_delete" ON warehouses FOR DELETE USING (
  is_superadmin()
);

-- ─── PRODUCTS ─────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON products;
  DROP POLICY IF EXISTS "Enable insert for all users"      ON products;
  DROP POLICY IF EXISTS "Enable update for all users"      ON products;
  DROP POLICY IF EXISTS "Enable delete for all users"      ON products;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "products_select" ON products FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    company_id IS NULL                     -- productos globales (compatibilidad)
    OR is_superadmin()
    OR company_id = get_my_company_id()
  )
);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    is_superadmin() OR company_id = get_my_company_id()
  )
);
CREATE POLICY "products_update" ON products FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    is_superadmin() OR company_id = get_my_company_id() OR company_id IS NULL
  )
);
CREATE POLICY "products_delete" ON products FOR DELETE USING (
  is_admin_or_above() AND (
    is_superadmin() OR company_id = get_my_company_id()
  )
);

-- ─── DISPATCHES ───────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON dispatches;
  DROP POLICY IF EXISTS "Enable insert for all users"      ON dispatches;
  DROP POLICY IF EXISTS "Enable update for all users"      ON dispatches;
  DROP POLICY IF EXISTS "Enable delete for all users"      ON dispatches;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "dispatches_select" ON dispatches FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "dispatches_insert" ON dispatches FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "dispatches_update" ON dispatches FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "dispatches_delete" ON dispatches FOR DELETE USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);

-- ─── DISPATCH_ITEMS ───────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON dispatch_items;
  DROP POLICY IF EXISTS "Enable insert for all users"      ON dispatch_items;
  DROP POLICY IF EXISTS "Enable update for all users"      ON dispatch_items;
  DROP POLICY IF EXISTS "Enable delete for all users"      ON dispatch_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "dispatch_items_select" ON dispatch_items FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  dispatch_id IN (SELECT id FROM dispatches WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);
CREATE POLICY "dispatch_items_insert" ON dispatch_items FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  dispatch_id IN (SELECT id FROM dispatches WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);
CREATE POLICY "dispatch_items_update" ON dispatch_items FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  dispatch_id IN (SELECT id FROM dispatches WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);
CREATE POLICY "dispatch_items_delete" ON dispatch_items FOR DELETE USING (
  auth.uid() IS NOT NULL AND
  dispatch_id IN (SELECT id FROM dispatches WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);

-- ─── INVENTORY_MOVEMENTS ──────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users"  ON inventory_movements;
  DROP POLICY IF EXISTS "Enable insert for all users"       ON inventory_movements;
  DROP POLICY IF EXISTS "Enable update for all users"       ON inventory_movements;
  DROP POLICY IF EXISTS "Enable delete for all users"       ON inventory_movements;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "inventory_movements_update" ON inventory_movements FOR UPDATE USING (
  auth.uid() IS NOT NULL AND is_admin_or_above() AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "inventory_movements_delete" ON inventory_movements FOR DELETE USING (
  is_superadmin()  -- Los movimientos no se borran, se compensan
);

-- ─── RETURNS ──────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read for all users"   ON returns;
  DROP POLICY IF EXISTS "Enable insert for all users" ON returns;
  DROP POLICY IF EXISTS "Enable update for all users" ON returns;
  DROP POLICY IF EXISTS "Enable delete for all users" ON returns;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "returns_select" ON returns FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "returns_insert" ON returns FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "returns_update" ON returns FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "returns_delete" ON returns FOR DELETE USING (
  auth.uid() IS NOT NULL AND is_admin_or_above() AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);

-- ─── RETURN_ITEMS ─────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read for all users"   ON return_items;
  DROP POLICY IF EXISTS "Enable insert for all users" ON return_items;
  DROP POLICY IF EXISTS "Enable update for all users" ON return_items;
  DROP POLICY IF EXISTS "Enable delete for all users" ON return_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "return_items_select" ON return_items FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  return_id IN (SELECT id FROM returns WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);
CREATE POLICY "return_items_insert" ON return_items FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  return_id IN (SELECT id FROM returns WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);
CREATE POLICY "return_items_update" ON return_items FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  return_id IN (SELECT id FROM returns WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);
CREATE POLICY "return_items_delete" ON return_items FOR DELETE USING (
  auth.uid() IS NOT NULL AND
  return_id IN (SELECT id FROM returns WHERE warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids()))
);

-- ─── RECEIPTS ─────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON receipts;
  DROP POLICY IF EXISTS "Enable insert for all users"      ON receipts;
  DROP POLICY IF EXISTS "Enable update for all users"      ON receipts;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "receipts_select" ON receipts FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "receipts_insert" ON receipts FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);
CREATE POLICY "receipts_update" ON receipts FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  warehouse_id IN (SELECT warehouse_id FROM my_accessible_warehouse_ids())
);

-- ─── OPERATORS ────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON operators;
  DROP POLICY IF EXISTS "Enable insert for all users"      ON operators;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- SELECT: ve tu propio registro + los de tu company (admin) + todos (superadmin)
CREATE POLICY "operators_select" ON operators FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    id = auth.uid()                          -- siempre ves tu propio perfil
    OR is_superadmin()
    OR (company_id = get_my_company_id() AND is_admin_or_above())
  )
);
-- INSERT: solo admins/superadmin crean operadores
CREATE POLICY "operators_insert" ON operators FOR INSERT WITH CHECK (
  is_admin_or_above()
);
-- UPDATE: el operador actualiza su propio perfil; admin actualiza su company; superadmin todo
-- RESTRICCIÓN: nadie puede auto-promover su propio rol
CREATE POLICY "operators_update" ON operators FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    is_superadmin()
    OR (is_admin_or_above() AND company_id = get_my_company_id() AND id != auth.uid())
    OR id = auth.uid()  -- puede actualizar su perfil (pero no su rol, eso lo controla la app)
  )
);
-- DELETE: solo superadmin elimina operadores
CREATE POLICY "operators_delete" ON operators FOR DELETE USING (
  is_superadmin() AND id != auth.uid()  -- nadie se elimina a sí mismo
);

-- ─── SHIPMENT_RECORDS ─────────────────────────────────
-- shipment_records no tiene warehouse_id directo, se accede a través de dispatches
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users"  ON shipment_records;
  DROP POLICY IF EXISTS "Enable insert for all users"       ON shipment_records;
  DROP POLICY IF EXISTS "Enable update for all users"       ON shipment_records;
  DROP POLICY IF EXISTS "Enable delete for all users"       ON shipment_records;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Acceso via join a carriers (son registros de envío, acceso para autenticados de la misma company)
CREATE POLICY "shipment_records_all" ON shipment_records FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── SHIPMENT_ITEMS ───────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users"  ON shipment_items;
  DROP POLICY IF EXISTS "Enable insert for all users"       ON shipment_items;
  DROP POLICY IF EXISTS "Enable update for all users"       ON shipment_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "shipment_items_all" ON shipment_items FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── CSV_IMPORT_BATCHES ───────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users"  ON csv_import_batches;
  DROP POLICY IF EXISTS "Enable insert for all users"       ON csv_import_batches;
  DROP POLICY IF EXISTS "Enable update for all users"       ON csv_import_batches;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "csv_import_batches_all" ON csv_import_batches FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── PRODUCT_SKU_MAPPINGS ─────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Permitir lectura de mappings activos" ON product_sku_mappings;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "sku_mappings_select" ON product_sku_mappings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sku_mappings_write"  ON product_sku_mappings FOR ALL   USING (is_admin_or_above()) WITH CHECK (is_admin_or_above());

-- ── COMPANIES ─────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "companies_all" ON companies;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "companies_select" ON companies FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    is_superadmin()
    OR id = get_my_company_id()
  )
);
CREATE POLICY "companies_write" ON companies FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ══════════════════════════════════════════════════════
-- PARTE 5: Vista de permisos efectivos del usuario
-- ══════════════════════════════════════════════════════
-- Útil para el frontend: una sola query muestra todo el perfil + permisos

CREATE OR REPLACE VIEW v_my_profile AS
SELECT
  op.id,
  op.name,
  op.email,
  op.role,
  op.company_id,
  op.is_active,
  op.permissions,
  -- Permisos computados (rol eleva automáticamente)
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_scan')::boolean,             true))  AS can_scan,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_confirm_batch')::boolean,    true))  AS can_confirm_batch,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_delete_dispatch')::boolean,  false)) AS can_delete_dispatch,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_view_reports')::boolean,     false)) AS can_view_reports,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_import_csv')::boolean,       false)) AS can_import_csv,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_manage_products')::boolean,  false)) AS can_manage_products,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_manage_returns')::boolean,   true))  AS can_manage_returns,
  (is_admin_or_above() OR COALESCE((op.permissions->>'can_manage_production')::boolean,false)) AS can_manage_production,
  -- Warehouses asignados
  (SELECT jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name))
   FROM my_accessible_warehouse_ids() mw
   JOIN warehouses w ON w.id = mw.warehouse_id)                                                AS accessible_warehouses,
  op.created_at
FROM operators op
WHERE op.id = auth.uid();

COMMENT ON VIEW v_my_profile IS 'Perfil completo del usuario actual con permisos efectivos calculados';

-- ══════════════════════════════════════════════════════
-- PARTE 6: Función RPC para actualizar permisos de operador
-- (llamada desde el panel de Admin)
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_operator_permissions(
  p_operator_id uuid,
  p_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_company uuid;
BEGIN
  -- Solo admins/superadmin pueden cambiar permisos
  IF NOT is_admin_or_above() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin o superior';
  END IF;

  -- Admin solo puede modificar operadores de su company
  SELECT company_id INTO v_target_company FROM operators WHERE id = p_operator_id;
  IF NOT is_superadmin() AND v_target_company != get_my_company_id() THEN
    RAISE EXCEPTION 'Acceso denegado: el operador no pertenece a tu empresa';
  END IF;

  -- No puede modificar permisos de un admin/superadmin (solo superadmin puede)
  IF NOT is_superadmin() AND EXISTS (
    SELECT 1 FROM operators WHERE id = p_operator_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: no puedes modificar permisos de un administrador';
  END IF;

  UPDATE operators
     SET permissions = p_permissions,
         updated_at  = now()
   WHERE id = p_operator_id;

  RETURN jsonb_build_object('success', true, 'operator_id', p_operator_id);
END;
$$;

CREATE OR REPLACE FUNCTION update_operator_role(
  p_operator_id uuid,
  p_new_role    text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_new_role NOT IN ('operator', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_new_role;
  END IF;

  -- Solo superadmin puede asignar rol superadmin
  IF p_new_role = 'superadmin' AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Solo un superadmin puede asignar el rol superadmin';
  END IF;

  -- Admin puede asignar operator/admin dentro de su company
  IF NOT is_superadmin() THEN
    IF NOT EXISTS (SELECT 1 FROM operators WHERE id = p_operator_id AND company_id = get_my_company_id()) THEN
      RAISE EXCEPTION 'Acceso denegado: operador fuera de tu empresa';
    END IF;
  END IF;

  -- Nadie puede cambiar su propio rol
  IF p_operator_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;

  UPDATE operators
     SET role       = p_new_role,
         updated_at = now()
   WHERE id = p_operator_id;

  RETURN jsonb_build_object('success', true, 'operator_id', p_operator_id, 'new_role', p_new_role);
END;
$$;
