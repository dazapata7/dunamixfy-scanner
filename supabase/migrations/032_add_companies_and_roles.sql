-- =====================================================
-- MIGRATION 032: Sistema Multi-Tenant con Roles
-- =====================================================
-- Agrega soporte para 3 niveles de roles:
--   SuperAdmin → Admin (empresa) → Operador
-- Crea tabla companies (tenants) y junction operator_warehouses
-- =====================================================

-- ─────────────────────────────────────────────────
-- 1. Tabla COMPANIES (tenants / empresas)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_all" ON companies FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE companies IS 'Empresas/tenants. Cada Admin pertenece a una company.';

-- ─────────────────────────────────────────────────
-- 2. Agregar ROLE y COMPANY_ID a operators
-- ─────────────────────────────────────────────────
ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'operator'
    CHECK (role IN ('superadmin', 'admin', 'operator')),
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN operators.role       IS 'superadmin | admin | operator';
COMMENT ON COLUMN operators.company_id IS 'Empresa a la que pertenece (NULL para superadmin)';

-- Índice para filtrar operadores por empresa
CREATE INDEX IF NOT EXISTS idx_operators_company_id ON operators(company_id);

-- ─────────────────────────────────────────────────
-- 3. Agregar COMPANY_ID a warehouses (bodegas)
-- ─────────────────────────────────────────────────
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN warehouses.company_id IS 'Empresa dueña de esta bodega';

CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON warehouses(company_id);

-- ─────────────────────────────────────────────────
-- 4. Junction: OPERATOR_WAREHOUSES (operador ↔ bodega)
-- ─────────────────────────────────────────────────
-- Un operador puede trabajar en 1 o más bodegas de su empresa
CREATE TABLE IF NOT EXISTS operator_warehouses (
  operator_id  UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (operator_id, warehouse_id)
);

ALTER TABLE operator_warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_wh_all" ON operator_warehouses FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE operator_warehouses IS 'Asignación de operadores a bodegas específicas de su empresa';

-- ─────────────────────────────────────────────────
-- 5. Actualizar sync_operator_on_login
--    NO sobreescribe role ni company_id en conflicto
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_operator_on_login(
  user_id    UUID,
  user_email TEXT,
  user_name  TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO operators (id, name, email, role, created_at)
  VALUES (user_id, user_name, user_email, 'operator', NOW())
  ON CONFLICT (id) DO UPDATE
    SET name  = COALESCE(EXCLUDED.name,  operators.name),
        email = COALESCE(EXCLUDED.email, operators.email);
    -- IMPORTANT: role y company_id NO se modifican en conflicto
    -- Esto permite que admins y superadmins mantengan su rol al re-login
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────
-- 6. RPC: get_user_profile
--    Retorna role + datos de empresa para el frontend
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE (
  operator_id   UUID,
  operator_name TEXT,
  role          TEXT,
  company_id    UUID,
  company_name  TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id          AS operator_id,
    o.name        AS operator_name,
    o.role        AS role,
    o.company_id  AS company_id,
    c.name        AS company_name
  FROM operators o
  LEFT JOIN companies c ON c.id = o.company_id
  WHERE o.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_profile IS 'Retorna perfil completo (role, empresa) del usuario después del login';

-- ─────────────────────────────────────────────────
-- 7. RPC: register_company
--    Crea empresa y promueve al operador a admin
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION register_company(
  p_user_id      UUID,
  p_company_name TEXT,
  p_company_email TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Verificar que el usuario no tiene empresa ya
  IF EXISTS (SELECT 1 FROM operators WHERE id = p_user_id AND company_id IS NOT NULL) THEN
    RAISE EXCEPTION 'El usuario ya pertenece a una empresa';
  END IF;

  -- Crear empresa
  INSERT INTO companies (name, email, created_by)
  VALUES (p_company_name, p_company_email, p_user_id)
  RETURNING id INTO v_company_id;

  -- Promover operador a admin y asignar empresa
  UPDATE operators
  SET role       = 'admin',
      company_id = v_company_id
  WHERE id = p_user_id;

  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_company IS 'Crea empresa y convierte al usuario en admin de ella';

-- ─────────────────────────────────────────────────
-- 8. RPC: create_operator
--    Admin crea un operador en su empresa
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_operator_for_company(
  p_admin_id    UUID,
  p_new_user_id UUID,
  p_name        TEXT,
  p_email       TEXT,
  p_warehouse_ids UUID[] DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_company_id UUID;
  v_wh_id      UUID;
BEGIN
  -- Obtener empresa del admin
  SELECT company_id INTO v_company_id
  FROM operators WHERE id = p_admin_id AND role = 'admin';

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Solo un Admin puede crear operadores';
  END IF;

  -- Crear o actualizar operador
  INSERT INTO operators (id, name, email, role, company_id, created_at)
  VALUES (p_new_user_id, p_name, p_email, 'operator', v_company_id, NOW())
  ON CONFLICT (id) DO UPDATE
    SET role       = 'operator',
        company_id = v_company_id,
        name       = COALESCE(p_name, operators.name),
        email      = COALESCE(p_email, operators.email);

  -- Asignar bodegas si se especificaron
  IF p_warehouse_ids IS NOT NULL THEN
    FOREACH v_wh_id IN ARRAY p_warehouse_ids LOOP
      INSERT INTO operator_warehouses (operator_id, warehouse_id)
      VALUES (p_new_user_id, v_wh_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
