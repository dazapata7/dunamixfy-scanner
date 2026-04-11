-- =====================================================
-- DIAGNÓSTICO: Estado multi-tenant del WMS
-- =====================================================
-- Ejecuta cada bloque uno por uno en el SQL Editor
-- de Supabase para auditar dónde quedan los datos.
-- =====================================================

-- ── 1. EMPRESAS registradas ────────────────────────────
SELECT id, name, email, is_active, created_at
FROM companies
ORDER BY created_at;

-- ── 2. OPERADORES y su empresa/rol ─────────────────────
SELECT
  o.id,
  o.name,
  o.email,
  o.role,
  o.company_id,
  c.name AS company_name
FROM operators o
LEFT JOIN companies c ON c.id = o.company_id
ORDER BY o.role, o.name;

-- ── 3. BODEGAS por empresa ─────────────────────────────
SELECT
  w.id,
  w.name,
  w.company_id,
  c.name AS company_name,
  w.is_active
FROM warehouses w
LEFT JOIN companies c ON c.id = w.company_id
ORDER BY c.name NULLS FIRST, w.name;

-- ── 4. PRODUCTOS por empresa ───────────────────────────
-- Si company_id = NULL, el producto es "global" (visible por cualquier admin)
SELECT
  COALESCE(c.name, '⚠️ SIN EMPRESA (global)') AS empresa,
  COUNT(*) AS total_productos,
  COUNT(*) FILTER (WHERE p.type = 'simple')         AS simple,
  COUNT(*) FILTER (WHERE p.type = 'combo')          AS combo,
  COUNT(*) FILTER (WHERE p.type = 'raw_material')   AS raw_material,
  COUNT(*) FILTER (WHERE p.type = 'consumable')     AS consumable,
  COUNT(*) FILTER (WHERE p.type = 'semi_finished')  AS semi_finished,
  COUNT(*) FILTER (WHERE p.type = 'finished_good')  AS finished_good
FROM products p
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.is_active = true
GROUP BY c.name
ORDER BY empresa;

-- ── 5. CATEGORÍAS por empresa ──────────────────────────
SELECT
  COALESCE(c.name, '⚠️ SIN EMPRESA (global)') AS empresa,
  COUNT(*) AS total_categorias
FROM product_categories pc
LEFT JOIN companies c ON c.id = pc.company_id
WHERE pc.is_active = true
GROUP BY c.name
ORDER BY empresa;

-- ── 6. BOMs por empresa (vía el producto) ──────────────
-- bom_headers no tiene company_id propio — se hereda del producto
SELECT
  COALESCE(c.name, '⚠️ SIN EMPRESA') AS empresa,
  COUNT(*) AS total_boms_activos
FROM bom_headers bh
JOIN products p ON p.id = bh.product_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE bh.is_active = true
GROUP BY c.name
ORDER BY empresa;

-- ── 7. ÓRDENES DE PRODUCCIÓN por empresa (vía warehouse) ─
-- production_orders no tiene company_id propio — se hereda del warehouse
SELECT
  COALESCE(c.name, '⚠️ SIN EMPRESA') AS empresa,
  po.status,
  COUNT(*) AS total
FROM production_orders po
JOIN warehouses w ON w.id = po.warehouse_id
LEFT JOIN companies c ON c.id = w.company_id
GROUP BY c.name, po.status
ORDER BY empresa, po.status;

-- ── 8. MOVIMIENTOS DE INVENTARIO por empresa ───────────
SELECT
  COALESCE(c.name, '⚠️ SIN EMPRESA') AS empresa,
  COUNT(*) AS total_movimientos,
  MIN(im.created_at)::date AS primero,
  MAX(im.created_at)::date AS ultimo
FROM inventory_movements im
JOIN warehouses w ON w.id = im.warehouse_id
LEFT JOIN companies c ON c.id = w.company_id
GROUP BY c.name
ORDER BY empresa;

-- ── 9. PRODUCTOS HUÉRFANOS: sin company_id ─────────────
-- Lista los nombres específicos para que puedas verificarlos
SELECT id, sku, name, type, created_at
FROM products
WHERE company_id IS NULL AND is_active = true
ORDER BY type, sku;

-- ── 10. CATEGORÍAS HUÉRFANAS: sin company_id ───────────
SELECT id, name, parent_id, created_at
FROM product_categories
WHERE company_id IS NULL AND is_active = true
ORDER BY name;
