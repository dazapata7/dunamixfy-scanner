// =====================================================
// PRODUCTION CAPACITY - Dunamix WMS
// =====================================================
// Cálculo recursivo de "stock producible" con memoización.
//
// Tres dimensiones de stock por producto:
//   - físico:     SUM(qty_signed) de inventory_stock_view (lo ya armado)
//   - reservado:  SUM(qty_required - qty_consumed) de OPs in_progress + paused
//   - disponible: físico - reservado (lo libre para nuevas OPs)
//
// Para productos con BOM (semi_finished / finished_good) calculamos también:
//   - producible: cuántas unidades podrían fabricarse usando el disponible
//                 de los insumos + lo producible (recursivo) de los sub-BOMs.
//
// LIMITACIÓN OPTIMISTA CONOCIDA:
// Si dos productos comparten un insumo, cada uno muestra su capacidad máxima
// asumiendo acceso exclusivo al pool. Es un límite superior por producto,
// no simultáneo. La asignación factible es trabajo futuro.
// =====================================================

export function buildBomMap(bomList) {
  const map = {};
  for (const bom of bomList || []) {
    if (!bom?.product_id) continue;
    map[bom.product_id] = {
      id: bom.id,
      items: (bom.items || []).map(it => ({
        component_product_id: it.component_product_id,
        qty_required: Number(it.qty_required) || 0,
        waste_factor: Number(it.waste_factor) || 1,
      })),
    };
  }
  return map;
}

export function buildStockMap(stockRows) {
  const map = {};
  for (const r of stockRows || []) {
    map[r.product_id] = Number(r.qty_on_hand) || 0;
  }
  return map;
}

export function buildReservedMap(reservedRows) {
  const map = {};
  for (const r of reservedRows || []) {
    map[r.product_id] = (map[r.product_id] || 0) + (Number(r.qty_reserved) || 0);
  }
  return map;
}

/**
 * Calcula recursivamente cuántas unidades del producto pueden fabricarse.
 * Memoiza en ctx.cache. Detecta ciclos devolviendo 0.
 *
 * ctx:
 *   - bomMap:      { productId: { items: [...] } }
 *   - stockMap:    { productId: físico }
 *   - reservedMap: { productId: reservado }
 *   - cache:       Map (memoización)
 *   - visiting:    Set (detección de ciclos)
 */
export function getProducible(productId, ctx) {
  if (!productId) return 0;
  if (ctx.cache.has(productId)) return ctx.cache.get(productId);

  // Detección de ciclo en BOM (A → B → A). Romper con 0.
  if (ctx.visiting.has(productId)) return 0;

  const bom = ctx.bomMap[productId];
  if (!bom || !bom.items?.length) {
    // Insumo puro o producto sin receta: no es "producible" por sí mismo
    ctx.cache.set(productId, 0);
    return 0;
  }

  ctx.visiting.add(productId);

  let min = Infinity;
  for (const item of bom.items) {
    const cid = item.component_product_id;
    const qtyNeeded = (Number(item.qty_required) || 0) * (Number(item.waste_factor) || 1);
    if (qtyNeeded <= 0) continue;

    const fisico     = ctx.stockMap[cid] || 0;
    const reservado  = ctx.reservedMap[cid] || 0;
    const disponible = Math.max(0, fisico - reservado);
    const recursivo  = getProducible(cid, ctx);
    const totalUsable = disponible + recursivo;

    const cap = Math.floor(totalUsable / qtyNeeded);
    if (cap < min) min = cap;
    if (min === 0) break; // ya no puede bajar más
  }

  ctx.visiting.delete(productId);

  const result = min === Infinity ? 0 : Math.max(0, min);
  ctx.cache.set(productId, result);
  return result;
}

/**
 * Construye un contexto listo para getProducible.
 */
export function buildCapacityContext({ bomList, stockRows, reservedRows }) {
  return {
    bomMap:      buildBomMap(bomList),
    stockMap:    buildStockMap(stockRows),
    reservedMap: buildReservedMap(reservedRows),
    cache:       new Map(),
    visiting:    new Set(),
  };
}

/**
 * Enriquece una lista de productos con:
 *   - stock_fisico
 *   - stock_reservado
 *   - stock_disponible
 *   - stock_producible   (solo para productos con BOM)
 */
export function enrichWithCapacity(products, ctx) {
  return (products || []).map(p => {
    const fisico     = ctx.stockMap[p.id] || 0;
    const reservado  = ctx.reservedMap[p.id] || 0;
    const disponible = Math.max(0, fisico - reservado);
    const producible = ctx.bomMap[p.id] ? getProducible(p.id, ctx) : 0;
    return {
      ...p,
      stock_fisico:     fisico,
      stock_reservado:  reservado,
      stock_disponible: disponible,
      stock_producible: producible,
    };
  });
}
