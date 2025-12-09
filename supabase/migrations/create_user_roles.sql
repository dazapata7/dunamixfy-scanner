-- ============================================================================
-- TABLA: user_roles
-- ============================================================================
-- Almacena los roles de usuarios (admin, operator)
-- Un usuario puede tener múltiples roles

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Evitar roles duplicados para el mismo usuario
  UNIQUE(user_id, role)
);

-- Índices para mejorar performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver todos los roles
CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden asignar roles
CREATE POLICY "Admins can insert roles" ON user_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden eliminar roles
CREATE POLICY "Admins can delete roles" ON user_roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Los usuarios pueden ver sus propios roles
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- FUNCIÓN: Verificar si usuario es admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN: Obtener roles de usuario
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TABLE(role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT user_roles.role
  FROM user_roles
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA: Crear primer admin (EJECUTAR DESPUÉS DE CREAR TU USUARIO)
-- ============================================================================
-- Descomenta y reemplaza con tu user_id después de registrarte

-- INSERT INTO user_roles (user_id, role)
-- VALUES ('TU-USER-ID-AQUI', 'admin');

COMMENT ON TABLE user_roles IS 'Roles de usuarios del sistema';
COMMENT ON COLUMN user_roles.role IS 'Tipo de rol: admin (administrador) u operator (operario)';
