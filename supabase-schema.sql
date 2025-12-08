-- ============================================
-- SCHEMA DE SUPABASE PARA DUNAMIX SCANNER
-- ============================================
-- Ejecuta este script en: SQL Editor de Supabase
-- ============================================

-- 1. CREAR TABLA DE OPERARIOS
-- ============================================
CREATE TABLE IF NOT EXISTS operators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT operators_name_unique UNIQUE(name)
);

COMMENT ON TABLE operators IS 'Operarios que escanean códigos';
COMMENT ON COLUMN operators.name IS 'Nombre del operario';

-- 2. CREAR TABLA DE CÓDIGOS ESCANEADOS
-- ============================================
CREATE TABLE IF NOT EXISTS codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  carrier TEXT NOT NULL CHECK (carrier IN ('coordinadora', 'interrapidisimo')),
  store_name TEXT,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT codes_code_unique UNIQUE(code)
);

COMMENT ON TABLE codes IS 'Códigos QR/Barcode escaneados';
COMMENT ON COLUMN codes.code IS 'Código de seguimiento';
COMMENT ON COLUMN codes.carrier IS 'Transportadora: coordinadora o interrapidisimo';
COMMENT ON COLUMN codes.store_name IS 'Nombre de la tienda de origen';
COMMENT ON COLUMN codes.operator_id IS 'ID del operario que escaneó';

-- 3. CREAR ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_codes_created_at ON codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_codes_carrier ON codes(carrier);
CREATE INDEX IF NOT EXISTS idx_codes_operator ON codes(operator_id);
CREATE INDEX IF NOT EXISTS idx_codes_code ON codes(code);
CREATE INDEX IF NOT EXISTS idx_codes_store ON codes(store_name);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- 5. CREAR POLICIES PARA ACCESO PÚBLICO
-- ============================================
-- Nota: En producción, puedes agregar autenticación más estricta

-- Policies para operators
DROP POLICY IF EXISTS "Enable read access for all users" ON operators;
CREATE POLICY "Enable read access for all users" ON operators
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON operators;
CREATE POLICY "Enable insert for all users" ON operators
  FOR INSERT WITH CHECK (true);

-- Policies para codes
DROP POLICY IF EXISTS "Enable read access for all users" ON codes;
CREATE POLICY "Enable read access for all users" ON codes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON codes;
CREATE POLICY "Enable insert for all users" ON codes
  FOR INSERT WITH CHECK (true);

-- 6. CREAR FUNCIÓN PARA ESTADÍSTICAS DEL DÍA
-- ============================================
CREATE OR REPLACE FUNCTION get_today_stats()
RETURNS TABLE (
  total_count BIGINT,
  coordinadora_count BIGINT,
  interrapidisimo_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE carrier = 'coordinadora')::BIGINT as coordinadora_count,
    COUNT(*) FILTER (WHERE carrier = 'interrapidisimo')::BIGINT as interrapidisimo_count
  FROM codes
  WHERE created_at >= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CREAR VIEW PARA DASHBOARD
-- ============================================
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_scans,
  COUNT(*) FILTER (WHERE carrier = 'coordinadora') as coordinadora_scans,
  COUNT(*) FILTER (WHERE carrier = 'interrapidisimo') as interrapidisimo_scans,
  COUNT(DISTINCT operator_id) as unique_operators
FROM codes
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- 8. INSERTAR DATOS DE PRUEBA (OPCIONAL)
-- ============================================
-- Descomentar si quieres datos de prueba

-- INSERT INTO operators (name) VALUES
--   ('Daniel'),
--   ('María'),
--   ('Carlos')
-- ON CONFLICT (name) DO NOTHING;

-- INSERT INTO codes (code, carrier, operator_id)
-- SELECT
--   '24004158' || LPAD((1000 + i)::TEXT, 4, '0'),
--   CASE WHEN i % 2 = 0 THEN 'coordinadora' ELSE 'interrapidisimo' END,
--   (SELECT id FROM operators LIMIT 1)
-- FROM generate_series(1, 10) as i
-- ON CONFLICT (code) DO NOTHING;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT 'Tables created successfully' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('operators', 'codes');
