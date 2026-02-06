-- =====================================================
-- MIGRATION 011: Sincronizar Auth Users con Operators
-- =====================================================
-- Problema: operatorId de Supabase Auth no existe en operators table
-- Solución: Modificar operators para usar auth.users.id como PK
-- =====================================================

-- 1. OPCIÓN A: Modificar tabla operators para usar UUID de Auth
-- Primero, verificar si hay datos en la tabla operators
DO $$
BEGIN
  -- Si hay registros en operators, NO hacer cambios destructivos
  IF EXISTS (SELECT 1 FROM operators LIMIT 1) THEN
    RAISE NOTICE '⚠️  Tabla operators tiene datos. Creando registros faltantes...';

    -- Insertar operadores desde auth.users que no existen en operators
    INSERT INTO operators (id, name, created_at)
    SELECT
      au.id,
      COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)) as name,
      au.created_at
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM operators o WHERE o.id = au.id
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '✅ Operadores sincronizados desde auth.users';
  ELSE
    RAISE NOTICE '✅ Tabla operators vacía, lista para sincronización';
  END IF;
END $$;

-- 2. Crear función para auto-sincronizar nuevos usuarios de Auth
CREATE OR REPLACE FUNCTION sync_auth_user_to_operator()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se crea un usuario en auth.users, crear registro en operators
  INSERT INTO operators (id, name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
  SET name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear trigger en auth.users para auto-sincronizar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_auth_user_to_operator();

-- 4. Remover constraint UNIQUE(name) si existe (permitir duplicados por email)
ALTER TABLE operators DROP CONSTRAINT IF EXISTS operators_name_unique;

-- 5. Agregar email opcional para referencia
ALTER TABLE operators ADD COLUMN IF NOT EXISTS email TEXT;

-- 6. Actualizar operadores existentes con email de auth.users
UPDATE operators o
SET email = au.email
FROM auth.users au
WHERE o.id = au.id AND o.email IS NULL;

-- 7. Comentarios de documentación
COMMENT ON FUNCTION sync_auth_user_to_operator() IS 'Auto-sincroniza usuarios de auth.users a operators table';
COMMENT ON COLUMN operators.email IS 'Email del operador (sincronizado desde auth.users)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT
  'Operadores sincronizados:' as status,
  COUNT(*) as total_operators
FROM operators;

SELECT
  'Usuarios Auth sin operator:' as status,
  COUNT(*) as missing_operators
FROM auth.users au
LEFT JOIN operators o ON o.id = au.id
WHERE o.id IS NULL;
