-- =====================================================
-- MIGRATION 012: Fix Operators Sync (Remover Trigger Problemático)
-- =====================================================
-- Problema: Trigger en auth.users causa "Database error granting user"
-- Solución: Remover trigger y usar sincronización manual en código
-- =====================================================

-- 1. Remover trigger problemático de auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS sync_auth_user_to_operator();

-- 2. Verificar que todos los usuarios existentes estén sincronizados
DO $$
BEGIN
  -- Insertar operadores desde auth.users que no existen en operators
  INSERT INTO operators (id, name, email, created_at)
  SELECT
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)) as name,
    au.email,
    au.created_at
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM operators o WHERE o.id = au.id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, operators.name),
    email = COALESCE(EXCLUDED.email, operators.email);

  RAISE NOTICE '✅ Operadores sincronizados desde auth.users (sin trigger)';
END $$;

-- 3. Crear función helper para sincronización manual (llamada desde código)
CREATE OR REPLACE FUNCTION sync_operator_on_login(user_id UUID, user_email TEXT, user_name TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO operators (id, name, email, created_at)
  VALUES (
    user_id,
    COALESCE(user_name, split_part(user_email, '@', 1)),
    user_email,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, operators.name),
    email = COALESCE(EXCLUDED.email, operators.email);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 4. Comentario de documentación
COMMENT ON FUNCTION sync_operator_on_login IS 'Sincroniza operador manualmente al hacer login (llamada desde código)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT
  'Usuarios sincronizados:' as status,
  COUNT(*) as total
FROM operators;

SELECT
  'Usuarios Auth sin operator:' as status,
  COUNT(*) as missing
FROM auth.users au
LEFT JOIN operators o ON o.id = au.id
WHERE o.id IS NULL;
