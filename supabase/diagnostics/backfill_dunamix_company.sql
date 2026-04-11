-- =====================================================
-- BACKFILL: Asignar toda la data huérfana a "Dunamix"
-- =====================================================
-- Idempotente: seguro re-ejecutar.
-- Crea la empresa si no existe, amarra warehouse, operators,
-- productos y categorías. Daniel queda como superadmin
-- (company_id NULL por diseño).
-- =====================================================
-- EJECUTAR COMO UN SOLO BLOQUE TRANSACCIONAL
BEGIN;

-- ── 1. Crear empresa Dunamix si no existe ──────────────
INSERT INTO companies (name, email, is_active)
SELECT 'Dunamix', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE lower(name) = 'dunamix'
);

-- ── 2. Capturar el ID de la empresa para reutilizar ───
DO $$
DECLARE
  v_company_id uuid;
  v_affected   int;
BEGIN
  SELECT id INTO v_company_id
  FROM companies
  WHERE lower(name) = 'dunamix'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear o encontrar la empresa Dunamix';
  END IF;

  RAISE NOTICE '✅ Dunamix company_id = %', v_company_id;

  -- ── 3. Warehouses: Bodega Envigado y cualquier huérfana ──
  UPDATE warehouses
  SET company_id = v_company_id
  WHERE company_id IS NULL;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RAISE NOTICE '📦 Warehouses actualizados: %', v_affected;

  -- ── 4. Operadores no-superadmin huérfanos ──────────────
  -- Daniel (superadmin) queda intacto con company_id = NULL
  UPDATE operators
  SET company_id = v_company_id
  WHERE company_id IS NULL
    AND role <> 'superadmin';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RAISE NOTICE '👤 Operadores actualizados: %', v_affected;

  -- ── 5. Productos huérfanos ─────────────────────────────
  UPDATE products
  SET company_id = v_company_id
  WHERE company_id IS NULL;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RAISE NOTICE '🏷️  Productos actualizados: %', v_affected;

  -- ── 6. Categorías huérfanas ────────────────────────────
  UPDATE product_categories
  SET company_id = v_company_id
  WHERE company_id IS NULL;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RAISE NOTICE '📁 Categorías actualizadas: %', v_affected;
END $$;

COMMIT;

-- =====================================================
-- VERIFICACIÓN post-backfill
-- =====================================================
-- Todos estos conteos de huérfanos deben ser 0
-- (excepto el de operators que debe ser 1: Daniel superadmin)

SELECT
  'warehouses sin empresa' AS tabla,
  COUNT(*) AS huerfanos
FROM warehouses
WHERE company_id IS NULL
UNION ALL
SELECT
  'operators sin empresa (debe ser 1: Daniel superadmin)',
  COUNT(*)
FROM operators
WHERE company_id IS NULL
UNION ALL
SELECT
  'products sin empresa',
  COUNT(*)
FROM products
WHERE company_id IS NULL AND is_active = true
UNION ALL
SELECT
  'product_categories sin empresa',
  COUNT(*)
FROM product_categories
WHERE company_id IS NULL AND is_active = true;
