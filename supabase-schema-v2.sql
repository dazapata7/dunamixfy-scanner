-- ============================================
-- DUNAMIX SCANNER - SCHEMA COMPLETO V2
-- Base de datos normalizada y escalable
-- ============================================

-- 1. TABLA DE TRANSPORTADORAS
-- ============================================
CREATE TABLE IF NOT EXISTS carriers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE, -- Código interno: 'coordinadora', 'interrapidisimo'
  display_name TEXT NOT NULL, -- Nombre para mostrar: 'Coordinadora', 'Interrápidisimo'
  
  -- Reglas de validación (JSON)
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Configuración de extracción de código
  extraction_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE carriers IS 'Catálogo de transportadoras con sus reglas de validación';
COMMENT ON COLUMN carriers.code IS 'Código único de la transportadora (slug)';
COMMENT ON COLUMN carriers.validation_rules IS 'Reglas de validación en formato JSON';
COMMENT ON COLUMN carriers.extraction_config IS 'Configuración para extraer código del QR/Barcode';

-- Índices
CREATE INDEX IF NOT EXISTS idx_carriers_code ON carriers(code);
CREATE INDEX IF NOT EXISTS idx_carriers_active ON carriers(is_active);

-- 2. TABLA DE TIENDAS
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT, -- Código interno opcional
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE stores IS 'Catálogo de tiendas/stores de e-commerce';

-- Índices
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);

-- 3. TABLA DE OPERARIOS (Mejorada)
-- ============================================
CREATE TABLE IF NOT EXISTS operators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT operators_name_unique UNIQUE(name)
);

COMMENT ON TABLE operators IS 'Operarios que escanean códigos';

-- Índices
CREATE INDEX IF NOT EXISTS idx_operators_name ON operators(name);
CREATE INDEX IF NOT EXISTS idx_operators_active ON operators(is_active);

-- 4. TABLA DE CÓDIGOS ESCANEADOS (Refactorizada)
-- ============================================
CREATE TABLE IF NOT EXISTS codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  
  -- Relaciones
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  
  -- Metadatos
  raw_scan TEXT, -- Contenido completo del QR/Barcode (para debugging)
  scan_type TEXT CHECK (scan_type IN ('qr', 'barcode', 'manual')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT codes_code_unique UNIQUE(code)
);

COMMENT ON TABLE codes IS 'Códigos QR/Barcode escaneados';
COMMENT ON COLUMN codes.code IS 'Código extraído y normalizado';
COMMENT ON COLUMN codes.raw_scan IS 'Contenido original del QR/Barcode';
COMMENT ON COLUMN codes.scan_type IS 'Tipo de escaneo realizado';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_codes_created_at ON codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_codes_carrier ON codes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_codes_store ON codes(store_id);
CREATE INDEX IF NOT EXISTS idx_codes_operator ON codes(operator_id);
CREATE INDEX IF NOT EXISTS idx_codes_code ON codes(code);

-- 5. HABILITAR ROW LEVEL SECURITY
-- ============================================
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES PARA ACCESO PÚBLICO (Ajustar en producción)
-- ============================================

-- Carriers: Solo lectura para todos
DROP POLICY IF EXISTS "Enable read access for all users" ON carriers;
CREATE POLICY "Enable read access for all users" ON carriers
  FOR SELECT USING (true);

-- Stores: Lectura para todos, inserción para autenticados
DROP POLICY IF EXISTS "Enable read access for all users" ON stores;
CREATE POLICY "Enable read access for all users" ON stores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON stores;
CREATE POLICY "Enable insert for all users" ON stores
  FOR INSERT WITH CHECK (true);

-- Operators: Lectura e inserción para todos
DROP POLICY IF EXISTS "Enable read access for all users" ON operators;
CREATE POLICY "Enable read access for all users" ON operators
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON operators;
CREATE POLICY "Enable insert for all users" ON operators
  FOR INSERT WITH CHECK (true);

-- Codes: Lectura e inserción para todos
DROP POLICY IF EXISTS "Enable read access for all users" ON codes;
CREATE POLICY "Enable read access for all users" ON codes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON codes;
CREATE POLICY "Enable insert for all users" ON codes
  FOR INSERT WITH CHECK (true);

-- 7. INSERTAR TRANSPORTADORAS INICIALES
-- ============================================
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config, is_active)
VALUES 
  (
    'Coordinadora',
    'coordinadora',
    'Coordinadora',
    '{
      "pattern": "ends_with_001",
      "min_length": 20,
      "description": "Debe terminar en 001 y tener más de 20 caracteres"
    }'::jsonb,
    '{
      "method": "slice",
      "start": -14,
      "end": -3,
      "description": "11 dígitos antes de los últimos 3 (001)"
    }'::jsonb,
    true
  ),
  (
    'Interrápidisimo',
    'interrapidisimo',
    'Interrápidisimo',
    '{
      "pattern": "starts_with_24",
      "length": [12, 13],
      "digits_only": true,
      "description": "12 o 13 dígitos que empiezan con 24"
    }'::jsonb,
    '{
      "method": "substring",
      "length": 12,
      "description": "Primeros 12 dígitos si tiene 13"
    }'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  validation_rules = EXCLUDED.validation_rules,
  extraction_config = EXCLUDED.extraction_config,
  updated_at = timezone('utc'::text, now());

-- 8. INSERTAR TIENDAS INICIALES
-- ============================================
INSERT INTO stores (name, code, is_active)
VALUES 
  ('Dunamixfy', 'dunamixfy', true),
  ('Femme Cosmetics', 'femme', true),
  ('Rodillax Store', 'rodillax', true),
  ('Lumbrax Store', 'lumbrax', true),
  ('Drop1 SAS', 'drop1', true)
ON CONFLICT (name) DO NOTHING;

-- 9. FUNCIONES AUXILIARES
-- ============================================

-- Función para obtener estadísticas del día
CREATE OR REPLACE FUNCTION get_today_stats()
RETURNS TABLE (
  total_count BIGINT,
  by_carrier JSONB,
  by_store JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      jsonb_object_agg(
        COALESCE(c.display_name, 'Sin transportadora'),
        carrier_count
      ) as carriers,
      jsonb_object_agg(
        COALESCE(s.name, 'Sin tienda'),
        store_count
      ) FILTER (WHERE s.name IS NOT NULL) as stores
    FROM (
      SELECT 
        carrier_id,
        store_id,
        COUNT(*) as carrier_count,
        COUNT(*) as store_count
      FROM codes
      WHERE created_at >= CURRENT_DATE
      GROUP BY carrier_id, store_id
    ) code_stats
    LEFT JOIN carriers c ON c.id = code_stats.carrier_id
    LEFT JOIN stores s ON s.id = code_stats.store_id
  )
  SELECT 
    total::BIGINT,
    carriers,
    COALESCE(stores, '{}'::jsonb)
  FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_carriers_updated_at ON carriers;
CREATE TRIGGER update_carriers_updated_at
  BEFORE UPDATE ON carriers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_operators_updated_at ON operators;
CREATE TRIGGER update_operators_updated_at
  BEFORE UPDATE ON operators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. VISTAS ÚTILES
-- ============================================

-- Vista con joins para facilitar queries
CREATE OR REPLACE VIEW codes_detailed AS
SELECT 
  c.id,
  c.code,
  c.raw_scan,
  c.scan_type,
  c.created_at,
  carr.name as carrier_name,
  carr.display_name as carrier_display_name,
  carr.code as carrier_code,
  s.name as store_name,
  s.code as store_code,
  o.name as operator_name
FROM codes c
LEFT JOIN carriers carr ON c.carrier_id = carr.id
LEFT JOIN stores s ON c.store_id = s.id
LEFT JOIN operators o ON c.operator_id = o.id;

-- Vista de dashboard con stats
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  DATE(c.created_at) as date,
  COUNT(*) as total_scans,
  COUNT(DISTINCT c.operator_id) as unique_operators,
  COUNT(DISTINCT c.store_id) as unique_stores,
  jsonb_object_agg(
    carr.display_name,
    carrier_count
  ) as scans_by_carrier
FROM codes c
LEFT JOIN carriers carr ON c.carrier_id = carr.id
LEFT JOIN (
  SELECT 
    DATE(created_at) as scan_date,
    carrier_id,
    COUNT(*) as carrier_count
  FROM codes
  GROUP BY DATE(created_at), carrier_id
) carrier_stats ON DATE(c.created_at) = carrier_stats.scan_date 
  AND c.carrier_id = carrier_stats.carrier_id
GROUP BY DATE(c.created_at)
ORDER BY DATE(c.created_at) DESC;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  carriers_count INTEGER;
  stores_count INTEGER;
  operators_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO carriers_count FROM carriers;
  SELECT COUNT(*) INTO stores_count FROM stores;
  SELECT COUNT(*) INTO operators_count FROM operators;
  
  RAISE NOTICE '=================================';
  RAISE NOTICE 'VERIFICACIÓN DE INSTALACIÓN';
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Transportadoras: %', carriers_count;
  RAISE NOTICE 'Tiendas: %', stores_count;
  RAISE NOTICE 'Operarios: %', operators_count;
  RAISE NOTICE '=================================';
  
  IF carriers_count >= 2 AND stores_count >= 5 THEN
    RAISE NOTICE '✅ Base de datos instalada correctamente';
  ELSE
    RAISE WARNING '⚠️ Revisar datos iniciales';
  END IF;
END $$;

-- Mostrar tablas creadas
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('carriers', 'stores', 'operators', 'codes')
ORDER BY table_name;
