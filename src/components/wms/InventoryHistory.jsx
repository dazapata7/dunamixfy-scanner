// =====================================================
// INVENTORY HISTORY - Historial de Movimientos de Inventario
// =====================================================
// Desktop: tabla con columnas
// Mobile: cards compactas
// Reutilizable con prop `scope`:
//   - 'sales' (default): productos tipo simple/combo (módulo Inventario)
//   - 'production':      raw_material/consumable/semi/finished (módulo Producción)
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft, TrendingDown, TrendingUp,
  Package, Search, X, Download, RefreshCw, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PRODUCTION_TYPES = ['raw_material', 'consumable', 'semi_finished', 'finished_good'];
const SALES_TYPES      = ['simple', 'combo'];

// ── CSV helper ────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows.length) { toast.error('No hay datos para exportar'); return; }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function InventoryHistory({ scope = 'sales' } = {}) {
  const navigate = useNavigate();
  const isProduction = scope === 'production';

  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { loadMovements(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [scope]);

  async function loadMovements() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`*, product:products(id, name, sku, type, unit), carrier:carriers(id, display_name, code), operator:operators!user_id(id, name, email)`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const dispatchIds = [...new Set(data?.filter(m => m.ref_type === 'dispatch').map(m => m.ref_id) || [])];
      let dispatchMap = {};
      if (dispatchIds.length > 0) {
        const { data: dd } = await supabase.from('dispatches').select('id, dispatch_number, guide_code').in('id', dispatchIds);
        dispatchMap = Object.fromEntries(dd?.map(d => [d.id, d]) || []);
      }

      setMovements(data?.map(m => ({
        ...m,
        dispatch: m.ref_type === 'dispatch' ? dispatchMap[m.ref_id] : null,
        guide_code: m.ref_type === 'dispatch' && dispatchMap[m.ref_id] ? dispatchMap[m.ref_id].guide_code : null
      })) || []);
    } catch (error) {
      toast.error('Error al cargar historial de movimientos');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredMovements = movements.filter(m => {
    // Filtro por scope: producción vs venta (según tipo de producto)
    const productType = m.product?.type;
    if (isProduction) {
      if (!productType || !PRODUCTION_TYPES.includes(productType)) return false;
    } else {
      // Por defecto (sales): excluimos insumos de producción.
      // Incluimos tipos de venta y también movimientos sin producto asociado / tipo desconocido
      // para no ocultar datos legacy (productos viejos sin `type`).
      if (productType && PRODUCTION_TYPES.includes(productType)) return false;
    }

    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      m.product?.name?.toLowerCase().includes(q) ||
      m.product?.sku?.toLowerCase().includes(q) ||
      m.dispatch?.dispatch_number?.toLowerCase().includes(q) ||
      m.guide_code?.toLowerCase().includes(q) ||
      m.carrier?.display_name?.toLowerCase().includes(q) ||
      m.external_order_id?.toLowerCase().includes(q) ||
      m.operator?.name?.toLowerCase().includes(q) ||
      m.operator?.email?.toLowerCase().includes(q);

    const matchesType = typeFilter === 'all' || m.movement_type === (typeFilter === 'in' ? 'IN' : 'OUT');

    const date = new Date(m.created_at);
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
    const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : new Date('2099-12-31');

    return matchesSearch && matchesType && date >= from && date <= to;
  });

  function handleExportCSV() {
    const rows = filteredMovements.map(m => {
      const base = {
        Fecha:          m.created_at ? format(new Date(m.created_at), 'yyyy-MM-dd HH:mm', { locale: es }) : '',
        Tipo:           m.movement_type || '',
        Producto:       m.product?.name || '',
        SKU:            m.product?.sku || '',
        Cantidad:       Math.abs(m.qty_signed ?? m.quantity ?? 0),
        Usuario:        m.operator?.name || m.operator?.email || '',
      };
      if (isProduction) {
        return {
          ...base,
          Unidad:      m.product?.unit || '',
          Referencia:  m.ref_type || '',
          Descripcion: m.description || '',
        };
      }
      return {
        ...base,
        Guia:           m.guide_code || '',
        Orden:          m.external_order_id || '',
        Transportadora: m.carrier?.display_name || '',
        Referencia:     m.ref_type || '',
        Descripcion:    m.description || '',
      };
    });
    const filename = isProduction
      ? `movimientos_produccion_${new Date().toISOString().split('T')[0]}.csv`
      : `movimientos_inventario_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(rows, filename);
    toast.success(`${rows.length} movimientos exportados`);
  }

  const hasFilters = searchTerm || typeFilter !== 'all' || dateFrom || dateTo;
  const clearFilters = () => { setSearchTerm(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); };

  // ── Badge de tipo ─────────────────────────────────
  const TypeBadge = ({ type }) => type === 'OUT'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400/80 text-xs font-semibold">
        <TrendingDown className="w-3 h-3" /> Salida
      </span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400/80 text-xs font-semibold">
        <TrendingUp className="w-3 h-3" /> Entrada
      </span>;

  const QtyCell = ({ m }) => {
    const qty = Math.abs(m.qty_signed ?? m.quantity ?? 0);
    return (
      <span className={`font-bold tabular-nums text-sm ${m.movement_type === 'OUT' ? 'text-red-400' : 'text-primary-400'}`}>
        {m.movement_type === 'OUT' ? '-' : '+'}{qty}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* Header – solo móvil */}
        <div className="lg:hidden flex items-center gap-3">
          <button onClick={() => navigate(isProduction ? '/wms/production/dashboard' : '/wms')}
            className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h1 className="text-lg font-bold text-white">
            {isProduction ? 'Movimientos de Producción' : 'Movimientos'}
          </h1>
        </div>

        {/* ── Filtros ─────────────────────────────── */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-4">
          <div className="flex flex-wrap gap-2 items-center">

            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input type="text" placeholder="Buscar producto, guía, orden, usuario..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full pl-9"
              />
            </div>

            {/* Tipo */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/70 focus:outline-none focus:border-primary-500/40 transition-all px-3 py-2.5"
              style={{ colorScheme: 'dark' }}>
              <option value="all">Todos los tipos</option>
              <option value="in">Entradas (IN)</option>
              <option value="out">Salidas (OUT)</option>
            </select>

            {/* Fecha desde */}
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/70 focus:outline-none focus:border-primary-500/40 transition-all px-3 py-2.5"
              style={{ colorScheme: 'dark' }} />

            {/* Fecha hasta */}
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/70 focus:outline-none focus:border-primary-500/40 transition-all px-3 py-2.5"
              style={{ colorScheme: 'dark' }} />

            {/* Actualizar */}
            <button onClick={loadMovements} disabled={isLoading}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all disabled:opacity-40">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Limpiar */}
            {hasFilters && (
              <button onClick={clearFilters}
                className="bg-red-500/[0.08] border border-red-500/[0.15] text-red-400/70 hover:bg-red-500/[0.15] hover:text-red-400 px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm">
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}

            {/* CSV */}
            <button onClick={handleExportCSV} disabled={filteredMovements.length === 0}
              className="bg-primary-500/[0.08] border border-primary-500/20 text-primary-400/80 hover:text-primary-400 hover:bg-primary-500/15 px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm disabled:opacity-30">
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>

          {/* Contador */}
          <div className="mt-2.5 text-white/30 text-xs">
            {filteredMovements.length} de {movements.length} movimientos
            {hasFilters && <span className="ml-1.5 text-primary-400/70">· filtros activos</span>}
          </div>
        </div>

        {/* ── Loading ───────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}

        {/* ── DESKTOP: tabla ─────────────────────── */}
        {!isLoading && (
          <div className="hidden lg:block bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl overflow-hidden">
            {filteredMovements.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No hay movimientos con los filtros aplicados</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="mt-3 text-primary-400/70 text-sm hover:text-primary-400 transition-colors">
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-black/20">
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Tipo</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Producto</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-28">SKU</th>
                    <th className="px-4 py-3 text-center text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Cantidad</th>
                    {isProduction && (
                      <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-20">Unidad</th>
                    )}
                    {isProduction ? (
                      <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-32">Referencia</th>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-40">Transportadora</th>
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Guía</th>
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-28">Orden</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-32">Usuario</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-36">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-primary-500/[0.03] transition-colors group">
                      <td className="px-4 py-3"><TypeBadge type={m.movement_type} /></td>
                      <td className="px-4 py-3">
                        <p className="text-white/80 font-medium truncate max-w-[200px]" title={m.product?.name}>{m.product?.name || 'N/A'}</p>
                        {m.description && <p className="text-white/25 text-xs truncate max-w-[200px] mt-0.5">{m.description}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-white/40 text-xs">{m.product?.sku || '—'}</td>
                      <td className="px-4 py-3 text-center"><QtyCell m={m} /></td>
                      {isProduction && (
                        <td className="px-4 py-3 text-white/50 text-xs">{m.product?.unit || '—'}</td>
                      )}
                      {isProduction ? (
                        <td className="px-4 py-3 text-white/40 text-xs">{m.ref_type || '—'}</td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-white/60 text-sm truncate">{m.carrier?.display_name || '—'}</td>
                          <td className="px-4 py-3 font-mono text-white/60 text-xs">{m.guide_code || '—'}</td>
                          <td className="px-4 py-3 font-mono text-white/40 text-xs">{m.external_order_id || '—'}</td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        {m.operator?.name ? (
                          <div className="flex items-center gap-1.5 min-w-0" title={m.operator.email || ''}>
                            <User className="w-3 h-3 text-white/25 flex-shrink-0" />
                            <span className="text-white/60 text-xs truncate">{m.operator.name}</span>
                          </div>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-sm whitespace-nowrap">
                        {format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── MÓVIL: cards ──────────────────────── */}
        {!isLoading && (
          <div className="lg:hidden space-y-2">
            {filteredMovements.length === 0 ? (
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08]">
                <div className="py-16 text-center">
                  <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No hay movimientos</p>
                </div>
              </div>
            ) : filteredMovements.map(m => (
              <div key={m.id} className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-3">
                <div className="flex items-center justify-between mb-2">
                  <TypeBadge type={m.movement_type} />
                  <span className="text-white/30 text-xs">{format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: es })}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div><p className="text-white/30 mb-0.5">Producto</p><p className="text-white/70 font-medium truncate">{m.product?.name || 'N/A'}</p></div>
                  <div><p className="text-white/30 mb-0.5">Cantidad</p><QtyCell m={m} /></div>
                  {isProduction ? (
                    <>
                      <div><p className="text-white/30 mb-0.5">Unidad</p><p className="text-white/60 truncate">{m.product?.unit || '—'}</p></div>
                      <div><p className="text-white/30 mb-0.5">Referencia</p><p className="text-white/60 truncate">{m.ref_type || '—'}</p></div>
                    </>
                  ) : (
                    <>
                      <div><p className="text-white/30 mb-0.5">Transportadora</p><p className="text-white/60 truncate">{m.carrier?.display_name || '—'}</p></div>
                      <div><p className="text-white/30 mb-0.5">Guía</p><p className="text-white/60 font-mono truncate">{m.guide_code || '—'}</p></div>
                    </>
                  )}
                  <div className="col-span-2 pt-1.5 mt-1 border-t border-white/[0.05]">
                    <p className="text-white/30 mb-0.5">Usuario</p>
                    {m.operator?.name ? (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-white/25 flex-shrink-0" />
                        <span className="text-white/60 truncate">{m.operator.name}</span>
                      </div>
                    ) : (
                      <p className="text-white/30">—</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryHistory;
