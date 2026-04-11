-- =====================================================
-- 043 — INVENTORY RESERVED VIEW
-- =====================================================
-- Expone el stock de insumos que está "reservado" por órdenes de producción
-- actualmente activas (in_progress o paused). Se calcula como:
--
--   qty_reserved = MAX(qty_required - COALESCE(qty_consumed, 0), 0)
--
-- agregado por (warehouse_id, component_product_id).
--
-- Para calcular el stock realmente DISPONIBLE de un insumo en un almacén:
--
--   disponible = inventory_stock_view.qty_on_hand - inventory_reserved_view.qty_reserved
--
-- Cuando una OP se completa o cancela, sus filas dejan de aparecer en la vista
-- (status ya no está en el filtro), por lo que el reservado se libera sin
-- necesidad de triggers adicionales — es un cálculo en tiempo real.
-- =====================================================

CREATE OR REPLACE VIEW inventory_reserved_view AS
SELECT
  po.warehouse_id,
  pom.component_product_id AS product_id,
  SUM(GREATEST(pom.qty_required - COALESCE(pom.qty_consumed, 0), 0)) AS qty_reserved
FROM production_order_materials pom
JOIN production_orders po ON po.id = pom.production_order_id
WHERE po.status IN ('in_progress', 'paused')
GROUP BY po.warehouse_id, pom.component_product_id;

COMMENT ON VIEW inventory_reserved_view IS
'Insumos reservados por OPs activas (in_progress + paused). qty_reserved = MAX(qty_required - qty_consumed, 0). Para disponible usar: inventory_stock_view.qty_on_hand - qty_reserved.';

-- Grant de lectura al rol anon/authenticated (las políticas RLS de las tablas
-- subyacentes siguen aplicando via JOINs porque la vista no es SECURITY DEFINER).
GRANT SELECT ON inventory_reserved_view TO anon, authenticated;
