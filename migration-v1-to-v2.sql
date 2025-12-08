-- ============================================
-- MIGRATION: V1 → V2
-- Migrar de estructura simple a normalizada
-- ============================================
-- ⚠️ IMPORTANTE: Hacer backup antes de ejecutar
-- ============================================

-- PASO 1: Crear nuevas tablas
-- ============================================

-- Tabla de transportadoras
CREATE TABLE IF NOT EXISTS carriers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de tiendas
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PASO 2: Insertar transportadoras iniciales
-- ============================================
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config, is_active)
VALUES 
  (
    'Coordinadora',
    'coordinadora',
    'Coordinadora',
    '{
      "pattern": "ends_with_001",
      "min_length": 20
    }'::jsonb,
    '{
      "method": "slice",
      "start": -14,
      "end": -3
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
      "digits_only": true
    }'::jsonb,
    '{
      "method": "substring",
      "length": 12
    }'::jsonb,
    true
  )
ON CONFLICT (code) DO NOTHING;

-- PASO 3: Migrar tiendas existentes
-- ============================================
-- Si tienes datos en codes V1 con store_name, migrarlos
INSERT INTO stores (name, is_active)
SELECT DISTINCT store_name, true
FROM codes
WHERE store_name IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- PASO 4: Agregar columnas nuevas a operators
-- ============================================
ALTER TABLE operators ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- PASO 5: Renombrar tabla codes antigua (backup)
-- ============================================
ALTER TABLE IF EXISTS codes RENAME TO codes_v1_backup;

-- PASO 6: Crear nueva tabla codes
-- ============================================
CREATE TABLE codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  raw_scan TEXT,
  scan_type TEXT CHECK (scan_type IN ('qr', 'barcode', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT codes_code_unique UNIQUE(code)
);

-- PASO 7: Migrar datos de V1 a V2
-- ============================================
INSERT INTO codes (code, carrier_id, store_id, operator_id, created_at)
SELECT 
  c.code,
  carr.id as carrier_id,
  s.id as store_id,
  c.operator_id,
  c.created_at
FROM codes_v1_backup c
LEFT JOIN carriers carr ON c.carrier = carr.code
LEFT JOIN stores s ON c.store_name = s.name
ON CONFLICT (code) DO NOTHING;

-- PASO 8: Crear índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_carriers_code ON carriers(code);
CREATE INDEX IF NOT EXISTS idx_carriers_active ON carriers(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_operators_name ON operators(name);
CREATE INDEX IF NOT EXISTS idx_operators_active ON operators(is_active);
CREATE INDEX IF NOT EXISTS idx_codes_created_at ON codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_codes_carrier ON codes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_codes_store ON codes(store_id);
CREATE INDEX IF NOT EXISTS idx_codes_operator ON codes(operator_id);
CREATE INDEX IF NOT EXISTS idx_codes_code ON codes(code);

-- PASO 9: Habilitar RLS y policies
-- ============================================
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON carriers;
CREATE POLICY "Enable read access for all users" ON carriers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON stores;
CREATE POLICY "Enable read access for all users" ON stores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON stores;
CREATE POLICY "Enable insert for all users" ON stores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON codes;
CREATE POLICY "Enable read access for all users" ON codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON codes;
CREATE POLICY "Enable insert for all users" ON codes FOR INSERT WITH CHECK (true);

-- PASO 10: Crear vista codes_detailed
-- ============================================
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

-- PASO 11: Verificación
-- ============================================
DO $$
DECLARE
  v1_count INTEGER;
  v2_count INTEGER;
  carriers_count INTEGER;
  stores_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v1_count FROM codes_v1_backup;
  SELECT COUNT(*) INTO v2_count FROM codes;
  SELECT COUNT(*) INTO carriers_count FROM carriers;
  SELECT COUNT(*) INTO stores_count FROM stores;
  
  RAISE NOTICE '=================================';
  RAISE NOTICE 'MIGRACIÓN COMPLETADA';
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Códigos en V1: %', v1_count;
  RAISE NOTICE 'Códigos migrados a V2: %', v2_count;
  RAISE NOTICE 'Transportadoras: %', carriers_count;
  RAISE NOTICE 'Tiendas: %', stores_count;
  RAISE NOTICE '=================================';
  
  IF v2_count = v1_count THEN
    RAISE NOTICE '✅ Migración exitosa - Todos los códigos migrados';
  ELSE
    RAISE WARNING '⚠️ Revisar: Diferencia en cantidad de códigos';
  END IF;
END $$;

-- ============================================
-- NOTAS FINALES
-- ============================================
-- 1. La tabla codes_v1_backup contiene tus datos originales como backup
-- 2. Si todo está OK, puedes eliminarla después:
--    DROP TABLE codes_v1_backup;
-- 3. Actualiza tu aplicación para usar los nuevos servicios V2
-- ============================================
