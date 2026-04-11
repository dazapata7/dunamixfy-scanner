// =====================================================
// PRODUCTION DASHBOARD - Dunamix WMS
// =====================================================
// Panorama del módulo de producción:
//   - KPIs: insumos disponibles, semi producible, terminado producible, OPs activas
//   - Banner explicativo del cálculo optimista
//   - Sección "Listo para liberar a venta" con atajo Transferir
//   - Alertas: insumos bloqueadores + stock bajo
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  productsService, inventoryService, bomService, productionService,
} from '../../services/wmsService';
import { useStore } from '../../store/useStore';
import {
  buildCapacityContext, enrichWithCapacity,
} from '../../utils/productionCapacity';
import {
  ArrowLeft, Factory, Package, FlaskConical, Layers, Boxes,
  AlertTriangle, ArrowRightLeft, RefreshCw, Info, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TransferToSalesModal } from './TransferToSalesModal';

const LOW_STOCK_THRESHOLD = 3;

// ─────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, hint, color = 'text-white' }) {
  return (
    <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-white/40 text-[11px] uppercase tracking-[0.12em] font-medium">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {hint && <p className="text-white/30 text-xs mt-1">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────
export function ProductionDashboard() {
  const navigate = useNavigate();
  const selectedWarehouse = useStore(s => s.selectedWarehouse);
  const operator = useStore(s => s.operator);

  const [isLoading, setIsLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]); // enriquecidos
  const [orders, setOrders] = useState([]);
  const [transferProduct, setTransferProduct] = useState(null);

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [selectedWarehouse?.id]);

  async function loadData() {
    if (!selectedWarehouse?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [products, stockRows, reservedRows, bomList, ordersData] = await Promise.all([
        productsService.getAll(),
        inventoryService.getAllStock(selectedWarehouse.id),
        inventoryService.getReservedStock(selectedWarehouse.id),
        bomService.getAllActiveBoms(),
        productionService.getAll(selectedWarehouse.id),
      ]);

      const ctx = buildCapacityContext({ bomList, stockRows, reservedRows });
      const enriched = enrichWithCapacity(products, ctx).map(p => ({
        ...p,
        linked_name: p.linked_product_id
          ? products.find(x => x.id === p.linked_product_id)?.name || null
          : null,
        linked_sku: p.linked_product_id
          ? products.find(x => x.id === p.linked_product_id)?.sku || null
          : null,
      }));

      setAllProducts(enriched);
      setOrders(ordersData || []);
    } catch (err) {
      console.error('[ProductionDashboard] loadData error:', err);
      toast.error('Error al cargar el dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Cálculos agregados ─────────────────────────
  const insumos   = allProducts.filter(p => ['raw_material', 'consumable'].includes(p.type));
  const semis     = allProducts.filter(p => p.type === 'semi_finished');
  const finished  = allProducts.filter(p => p.type === 'finished_good');

  const totalInsumoDispo = insumos.reduce((s, p) => s + (p.stock_disponible || 0), 0);
  const totalSemiPosible = semis.reduce((s, p) => s + (p.stock_fisico || 0) + (p.stock_producible || 0), 0);
  const totalFinPosible  = finished.reduce((s, p) => s + (p.stock_fisico || 0) + (p.stock_producible || 0), 0);
  const opsActivas       = orders.filter(o => ['in_progress', 'paused'].includes(o.status)).length;

  // ─── Listo para liberar ─────────────────────────
  const readyToRelease = allProducts.filter(p =>
    ['finished_good', 'semi_finished'].includes(p.type)
    && p.linked_product_id
    && (p.stock_fisico || 0) > 0
  );

  // ─── Alertas ────────────────────────────────────
  // Insumos con disponible = 0 (bloquean cualquier producción que los use)
  const blockers = insumos
    .filter(p => (p.stock_disponible || 0) === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const lowStock = insumos
    .filter(p => (p.stock_disponible || 0) > 0 && (p.stock_disponible || 0) <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => (a.stock_disponible || 0) - (b.stock_disponible || 0));

  // ─── Render ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* Volver (móvil) */}
        <button onClick={() => navigate('/wms')}
          className="lg:hidden bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Header */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4 flex items-center gap-3">
          <Factory className="w-5 h-5 text-amber-400" />
          <div className="flex-1">
            <h1 className="text-white font-bold text-base">Dashboard de Producción</h1>
            <p className="text-white/30 text-xs">
              Bodega: <strong className="text-white/60">{selectedWarehouse?.name || '—'}</strong>
            </p>
          </div>
          <button onClick={loadData} disabled={isLoading}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-white/10 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && !selectedWarehouse?.id && (
          <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-8 text-center">
            <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Selecciona una bodega para ver el dashboard.</p>
          </div>
        )}

        {!isLoading && selectedWarehouse?.id && (
          <>
            {/* ── KPIs ──────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={FlaskConical} color="text-amber-400"
                label="Insumos disponibles" value={totalInsumoDispo}
                hint={`${insumos.length} SKUs de insumo`} />
              <KpiCard icon={Layers} color="text-purple-400"
                label="Semi — físico + producible" value={totalSemiPosible}
                hint={`${semis.length} semiterminados`} />
              <KpiCard icon={Boxes} color="text-emerald-400"
                label="Terminado — físico + producible" value={totalFinPosible}
                hint={`${finished.length} productos terminados`} />
              <KpiCard icon={Factory} color="text-primary-400"
                label="OPs activas" value={opsActivas}
                hint="in_progress + paused" />
            </div>

            {/* ── Banner explicativo ────────────── */}
            <div className="bg-blue-500/[0.04] border border-blue-500/20 rounded-2xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-300/90 font-semibold mb-1">Cálculo optimista del producible</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  El stock producible es un límite superior <strong>por producto</strong>: asume que cada uno tiene acceso exclusivo
                  al pool de insumos. Si dos productos comparten un insumo, ambos muestran su capacidad máxima — pero no se pueden
                  fabricar simultáneamente. Los insumos reservados por OPs activas ya están descontados.
                </p>
              </div>
            </div>

            {/* ── Listo para liberar a venta ────── */}
            <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-primary-400" />
                <h2 className="text-white font-semibold text-sm">Listo para liberar a venta</h2>
                <span className="ml-auto text-white/30 text-xs">{readyToRelease.length} {readyToRelease.length === 1 ? 'producto' : 'productos'}</span>
              </div>
              {readyToRelease.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No hay productos con stock físico vinculados a un producto de venta.</p>
                  <p className="text-white/20 text-xs mt-1">Completa una OP para ver productos aquí.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                  {readyToRelease.map(p => (
                    <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{p.name}</p>
                          <p className="text-white/30 text-xs font-mono">{p.sku}</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/50 text-[10px] font-semibold">
                          {p.type === 'finished_good' ? 'Terminado' : 'Semi'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Tag className="w-3 h-3 text-primary-400/60" />
                        <span className="text-primary-400/80 truncate">{p.linked_name}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          <p className="text-white/30 text-[10px] uppercase tracking-widest">Disponible</p>
                          <p className="text-white font-bold text-lg">{p.stock_fisico}</p>
                        </div>
                        <button onClick={() => setTransferProduct(p)}
                          className="bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-3 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center gap-1.5 text-xs">
                          <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Alertas ──────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Bloqueadores */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h2 className="text-white font-semibold text-sm">Insumos bloqueadores</h2>
                  <span className="ml-auto text-white/30 text-xs">{blockers.length}</span>
                </div>
                {blockers.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-emerald-400/60 text-xs">Todos los insumos tienen stock disponible</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/[0.04]">
                    {blockers.slice(0, 8).map(p => (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-sm truncate">{p.name}</p>
                          <p className="text-white/30 text-xs font-mono">{p.sku}</p>
                        </div>
                        <span className="text-red-400/80 text-xs font-semibold">0 {p.unit || 'uds'}</span>
                      </li>
                    ))}
                    {blockers.length > 8 && (
                      <li className="px-4 py-2 text-white/30 text-xs text-center">
                        + {blockers.length - 8} más
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Stock bajo */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="text-white font-semibold text-sm">Stock bajo</h2>
                  <span className="ml-auto text-white/30 text-xs">≤ {LOW_STOCK_THRESHOLD}</span>
                </div>
                {lowStock.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-white/30 text-xs">Sin insumos en nivel bajo</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/[0.04]">
                    {lowStock.slice(0, 8).map(p => (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-sm truncate">{p.name}</p>
                          <p className="text-white/30 text-xs font-mono">{p.sku}</p>
                        </div>
                        <span className="text-amber-400/80 text-xs font-semibold">
                          {p.stock_disponible} {p.unit || 'uds'}
                        </span>
                      </li>
                    ))}
                    {lowStock.length > 8 && (
                      <li className="px-4 py-2 text-white/30 text-xs text-center">
                        + {lowStock.length - 8} más
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═════════════ Transfer Modal ═════════════ */}
      {transferProduct && (
        <TransferToSalesModal
          source={transferProduct}
          linkedProduct={allProducts.find(p => p.id === transferProduct.linked_product_id)
            || { name: transferProduct.linked_name, sku: transferProduct.linked_sku }}
          warehouseId={selectedWarehouse?.id}
          operatorId={operator?.id}
          onClose={() => setTransferProduct(null)}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
}

export default ProductionDashboard;
