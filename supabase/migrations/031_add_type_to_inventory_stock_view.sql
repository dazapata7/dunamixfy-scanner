-- =====================================================
-- Migration 031: Agregar campo type a inventory_stock_view
-- =====================================================
-- Necesario para distinguir productos simples de combos en el inventario
-- =====================================================

DROP VIEW IF EXISTS inventory_stock_view;

CREATE VIEW inventory_stock_view AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  p.barcode,
  p.photo_url,
  p.type,                -- NUEVO: tipo de producto (simple/combo)
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  COALESCE(SUM(im.qty_signed), 0) AS qty_on_hand
FROM products p
CROSS JOIN warehouses w
LEFT JOIN inventory_movements im
  ON im.product_id = p.id
  AND im.warehouse_id = w.id
WHERE p.is_active = true
  AND w.is_active = true
GROUP BY p.id, p.sku, p.name, p.barcode, p.photo_url, p.type, w.id, w.code, w.name;

COMMENT ON VIEW inventory_stock_view IS 'Vista de stock actual por producto y almacén. Incluye tipo (simple/combo) para calcular capacidad estimada de combos.';
