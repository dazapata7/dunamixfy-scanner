-- =====================================================
-- PROMOVER: Leonel Dunque como admin de Dunamix
-- =====================================================
-- Prerrequisitos:
--   1. Usuario ya creado en Supabase Dashboard → Authentication → Users
--      con email: contacto@dunamixfy.com
--      (el trigger `on_auth_user_created` de migración 012 habrá creado
--       automáticamente la fila en public.operators)
--   2. Empresa "Dunamix" ya existe en companies
--      (si no, corre primero backfill_dunamix_company.sql)
--
-- Idempotente: seguro re-ejecutar.
-- Solo UPDATE — no se toca auth.users ni se reinsertan filas.
-- =====================================================
BEGIN;

DO $$
DECLARE
  v_company_id  uuid;
  v_operator_id uuid;
  v_email       text := 'contacto@dunamixfy.com';
BEGIN
  -- ── 1. Localizar empresa Dunamix ─────────────────────
  SELECT id INTO v_company_id
  FROM companies
  WHERE lower(name) = 'dunamix'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa Dunamix no existe. Corre primero supabase/diagnostics/backfill_dunamix_company.sql';
  END IF;

  -- ── 2. Localizar el operator creado por el trigger ───
  SELECT id INTO v_operator_id
  FROM operators
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION
      'No existe operator con email %. Crea primero el usuario en Supabase Dashboard → Authentication → Users → Add user (email: %, Auto Confirm Email marcado). El trigger on_auth_user_created sincronizará automáticamente la fila de operators.',
      v_email, v_email;
  END IF;

  -- ── 3. Promover a admin de Dunamix ────────────────────
  UPDATE operators
  SET
    name       = 'Leonel Dunque',
    role       = 'admin',
    company_id = v_company_id
  WHERE id = v_operator_id;

  RAISE NOTICE '✅ Leonel Dunque (id=%) promovido a admin de Dunamix (company_id=%)',
    v_operator_id, v_company_id;
END $$;

COMMIT;

-- =====================================================
-- VERIFICACIÓN post-promoción
-- =====================================================
-- Debe devolver 1 fila:
--   name         = 'Leonel Dunque'
--   email        = 'contacto@dunamixfy.com'
--   role         = 'admin'
--   company_name = 'Dunamix'

SELECT
  o.id,
  o.name,
  o.email,
  o.role,
  c.name AS company_name,
  o.created_at
FROM operators o
LEFT JOIN companies c ON c.id = o.company_id
WHERE lower(o.email) = 'contacto@dunamixfy.com';
