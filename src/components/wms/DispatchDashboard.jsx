// =====================================================
// DISPATCH DASHBOARD - Dunamix WMS
// =====================================================
// Dashboard con KPIs, filtros de fecha/tienda/transportadora
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { dispatchesService } from '../../services/wmsService';
import { dunamixfyService } from '../../services/dunamixfyService';
import {
  ArrowLeft,
  Package,
  TrendingUp,
  Store,
  Box,
  CheckCircle2,
  Clock,
  BarChart3,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  X,
  Truck,
  Star,
  Percent,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

// ─── Helpers de fecha ───────────────────────────────
function toLocalDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(iso) {
  const today = toLocalDateISO(new Date());
  const yesterday = toLocalDateISO(new Date(Date.now() - 86400000));
  if (iso === today) return 'Hoy';
  if (iso === yesterday) return 'Ayer';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Barra de progreso ──────────────────────────────
function ProgressBar({ value, max, color = 'bg-green-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-white/60 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, iconColor, valueColor = 'text-white' }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs font-medium">{label}</p>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-white/40 text-[11px]">{sub}</p>}
    </div>
  );
}

export function DispatchDashboard() {
  const navigate = useNavigate();
  const { selectedWarehouse } = useStore();

  const todayISO = toLocalDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [dispatches, setDispatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [searchGuide, setSearchGuide] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('all');
  const [filterStore, setFilterStore] = useState('all');

  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
    } else {
      loadDispatches(selectedDate);
    }
  }, [selectedWarehouse, selectedDate]);

  async function loadDispatches(dateISO) {
    setIsLoading(true);
    try {
      const data = await dispatchesService.getDispatchesByDate(dateISO, selectedWarehouse.id);
      setDispatches(data);
    } catch (error) {
      console.error('❌ Error al cargar despachos:', error);
      toast.error('Error al cargar despachos');
    } finally {
      setIsLoading(false);
    }
  }

  function shiftDay(delta) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const newISO = toLocalDateISO(d);
    if (newISO <= todayISO) setSelectedDate(newISO);
  }

  // ─── Eliminar dispatch ────────────────────────────
  async function handleDeleteDispatch(dispatchId, guideCode, dispatchNumber) {
    if (!confirm(`¿Eliminar guía ${guideCode}?\n\nSe revertirán los movimientos de inventario.`)) return;

    try {
      toast.loading('Eliminando dispatch...', { id: 'delete' });

      const { data, error } = await supabase.rpc('delete_dispatch_for_testing', {
        p_dispatch_number: dispatchNumber
      });

      if (error) throw error;

      if (data?.[0]?.success) {
        setDispatches(prev => prev.filter(d => d.id !== dispatchId));

        const dfxRes = await dunamixfyService.markOrderAsUnscanned(guideCode);
        if (!dfxRes.success) console.warn('⚠️ No se pudo marcar unscanned en Dunamixfy');

        toast.success('Dispatch eliminado', { id: 'delete' });
        await loadDispatches(selectedDate);
      } else {
        toast.error('Error: ' + (data?.[0]?.message || 'No se encontró el dispatch'), { id: 'delete' });
      }
    } catch (error) {
      console.error('❌ Error al eliminar dispatch:', error);
      toast.error(error.message || 'Error al eliminar dispatch', { id: 'delete' });
    }
  }

  // ─── Stats calculadas con useMemo ─────────────────
  const stats = useMemo(() => {
    const s = {
      total: dispatches.length,
      confirmed: 0,
      pending: 0,
      totalProducts: 0,
      byCarrier: {},
      byStore: {},
      byProduct: {},
    };

    dispatches.forEach(dispatch => {
      if (dispatch.status === 'confirmed') s.confirmed++;
      else s.pending++;

      const sr = Array.isArray(dispatch.shipment_record)
        ? dispatch.shipment_record[0]
        : dispatch.shipment_record;

      const carrier = sr?.carriers?.display_name || dispatch.carrier_name || 'Sin transportadora';
      const store = sr?.raw_payload?.store || sr?.raw_payload?.dropshipper || sr?.customer_name || 'Sin tienda';

      // Por transportadora
      if (!s.byCarrier[carrier]) s.byCarrier[carrier] = { total: 0, confirmed: 0 };
      s.byCarrier[carrier].total++;
      if (dispatch.status === 'confirmed') s.byCarrier[carrier].confirmed++;

      // Por tienda
      if (!s.byStore[store]) s.byStore[store] = { total: 0, confirmed: 0, products: {}, guides: [] };
      s.byStore[store].total++;
      if (dispatch.status === 'confirmed') s.byStore[store].confirmed++;
      s.byStore[store].guides.push({
        id: dispatch.id,
        guide_code: dispatch.guide_code,
        dispatch_number: dispatch.dispatch_number,
        status: dispatch.status,
        carrier,
      });

      // Productos
      (dispatch.dispatch_items || []).forEach(item => {
        const qty = item.qty || 0;
        s.totalProducts += qty;
        const key = item.products?.sku || item.sku || 'N/A';
        const name = item.products?.name || key;

        if (!s.byProduct[key]) s.byProduct[key] = { name, qty: 0 };
        s.byProduct[key].qty += qty;

        if (!s.byStore[store].products[key]) s.byStore[store].products[key] = { name, qty: 0 };
        s.byStore[store].products[key].qty += qty;
      });
    });

    return s;
  }, [dispatches]);

  // KPIs derivados
  const confirmRate = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  const avgProductsPerGuide = stats.total > 0 ? (stats.totalProducts / stats.total).toFixed(1) : '0';
  const topProduct = Object.entries(stats.byProduct).sort((a, b) => b[1].qty - a[1].qty)[0];

  // Listas para filtros
  const carrierOptions = useMemo(() => ['all', ...Object.keys(stats.byCarrier)], [stats.byCarrier]);
  const storeOptions = useMemo(() => ['all', ...Object.keys(stats.byStore)], [stats.byStore]);

  // ─── Filtrar tiendas para la vista ───────────────
  const filteredStores = useMemo(() => {
    return Object.entries(stats.byStore).filter(([storeName, storeData]) => {
      if (filterStore !== 'all' && storeName !== filterStore) return false;
      if (filterCarrier !== 'all') {
        const hasCarrier = storeData.guides.some(g => g.carrier === filterCarrier);
        if (!hasCarrier) return false;
      }
      if (searchGuide.trim()) {
        const term = searchGuide.trim().toLowerCase();
        const hasGuide = storeData.guides.some(g =>
          g.guide_code?.toLowerCase().includes(term) ||
          g.dispatch_number?.toLowerCase().includes(term)
        );
        if (!hasGuide) return false;
      }
      return true;
    });
  }, [stats.byStore, filterStore, filterCarrier, searchGuide]);

  const isToday = selectedDate === todayISO;
  const hasFilters = filterCarrier !== 'all' || filterStore !== 'all' || searchGuide.trim() !== '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Cargando despachos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/wms')}
            className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="flex items-center gap-1">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold hidden sm:block">Dashboard</span>
              <span className="text-white/50 text-sm hidden sm:block">· {selectedWarehouse?.name}</span>
            </div>
          </div>
        </div>

        {/* ── Selector de Fecha ── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDay(-1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white font-medium text-sm px-2 min-w-[80px] text-center">
              {formatDateLabel(selectedDate)}
            </span>
            <button
              onClick={() => shiftDay(1)}
              disabled={isToday}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Date picker oculto */}
          <label className="relative cursor-pointer p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all" title="Elegir fecha">
            <Calendar className="w-4 h-4" />
            <input
              type="date"
              value={selectedDate}
              max={todayISO}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              style={{ colorScheme: 'dark' }}
            />
          </label>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayISO)}
              className="px-2.5 py-1 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs hover:bg-primary-500/30 transition-all"
            >
              Hoy
            </button>
          )}

          {/* Recargar */}
          <button
            onClick={() => loadDispatches(selectedDate)}
            className="ml-auto px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-all flex items-center gap-1.5 text-xs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total Guías"
            value={stats.total}
            icon={Package}
            iconColor="text-blue-400"
            valueColor="text-white"
          />
          <KpiCard
            label="Confirmadas"
            value={stats.confirmed}
            icon={CheckCircle2}
            iconColor="text-green-400"
            valueColor="text-green-400"
          />
          <KpiCard
            label="Pendientes"
            value={stats.pending}
            icon={Clock}
            iconColor="text-orange-400"
            valueColor={stats.pending > 0 ? 'text-orange-400' : 'text-white/40'}
          />
          <KpiCard
            label="Tasa confirmación"
            value={`${confirmRate}%`}
            sub={stats.total > 0 ? `${stats.confirmed}/${stats.total}` : undefined}
            icon={Percent}
            iconColor="text-cyan-400"
            valueColor={confirmRate === 100 ? 'text-green-400' : confirmRate > 50 ? 'text-cyan-400' : 'text-orange-400'}
          />
          <KpiCard
            label="Total productos"
            value={stats.totalProducts}
            icon={Box}
            iconColor="text-purple-400"
            valueColor="text-purple-400"
          />
          <KpiCard
            label="Prom. prod/guía"
            value={avgProductsPerGuide}
            sub="productos por guía"
            icon={Layers}
            iconColor="text-pink-400"
            valueColor="text-white"
          />
        </div>

        {/* ── Mini stats: Transportadoras ── */}
        {Object.keys(stats.byCarrier).length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3">
            <p className="text-xs text-white/50 font-medium mb-3 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-green-400" />
              Por Transportadora
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.byCarrier)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([carrier, d]) => (
                  <div key={carrier} className="bg-white/5 rounded-xl border border-white/10 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white truncate pr-2">{carrier}</span>
                      <span className="text-white font-bold text-sm shrink-0">{d.total}</span>
                    </div>
                    <ProgressBar
                      value={d.confirmed}
                      max={d.total}
                      color={d.confirmed === d.total ? 'bg-green-500' : 'bg-blue-500'}
                    />
                    <p className="text-white/40 text-[10px] mt-1">{d.confirmed}/{d.total} confirmadas</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Top Producto ── */}
        {topProduct && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 shrink-0">
              <Star className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50">Producto más despachado</p>
              <p className="text-white font-medium text-sm truncate">{topProduct[1].name}</p>
              <p className="text-white/40 text-xs font-mono">{topProduct[0]}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-yellow-400">{topProduct[1].qty}</p>
              <p className="text-white/30 text-[10px]">unidades</p>
            </div>
          </div>
        )}

        {/* ── Filtros ── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap gap-2 items-center">
          {/* Búsqueda guía */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchGuide}
              onChange={e => setSearchGuide(e.target.value)}
              placeholder="Buscar guía o despacho..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>

          {/* Filtro transportadora */}
          <select
            value={filterCarrier}
            onChange={e => setFilterCarrier(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
            style={{ colorScheme: 'dark' }}
          >
            <option value="all" style={{ backgroundColor: '#111' }}>Todas las transportadoras</option>
            {carrierOptions.filter(c => c !== 'all').map(c => (
              <option key={c} value={c} style={{ backgroundColor: '#111' }}>{c}</option>
            ))}
          </select>

          {/* Filtro tienda */}
          <select
            value={filterStore}
            onChange={e => setFilterStore(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
            style={{ colorScheme: 'dark' }}
          >
            <option value="all" style={{ backgroundColor: '#111' }}>Todas las tiendas</option>
            {storeOptions.filter(s => s !== 'all').map(s => (
              <option key={s} value={s} style={{ backgroundColor: '#111' }}>{s}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearchGuide(''); setFilterCarrier('all'); setFilterStore('all'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs hover:bg-red-500/20 transition-all"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}

          <span className="text-white/30 text-xs ml-auto">
            {filteredStores.length} tienda{filteredStores.length !== 1 ? 's' : ''} · {stats.total} guía{stats.total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Sin datos ── */}
        {stats.total === 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-10 text-center">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">Sin despachos {isToday ? 'hoy' : `el ${formatDateLabel(selectedDate)}`}</p>
          </div>
        )}

        {/* ── Despachos por Tienda ── */}
        {filteredStores.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2 px-1">
              <Store className="w-4 h-4 text-blue-400" />
              Despachos por Tienda / Dropshipper
              {hasFilters && <span className="text-white/30 font-normal">(filtrado)</span>}
            </h2>

            {filteredStores.map(([storeName, storeData]) => {
              const pct = Math.round((storeData.confirmed / storeData.total) * 100);
              const isComplete = storeData.confirmed === storeData.total;

              // Filtrar guías según búsqueda y transportadora
              const visibleGuides = storeData.guides.filter(g => {
                if (filterCarrier !== 'all' && g.carrier !== filterCarrier) return false;
                if (searchGuide.trim()) {
                  const t = searchGuide.trim().toLowerCase();
                  return g.guide_code?.toLowerCase().includes(t) ||
                         g.dispatch_number?.toLowerCase().includes(t);
                }
                return true;
              });

              return (
                <div
                  key={storeName}
                  className={`bg-white/5 backdrop-blur-xl rounded-2xl border transition-all ${
                    isComplete ? 'border-green-500/20' : 'border-white/10'
                  }`}
                >
                  {/* Store header */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-sm">{storeName}</h3>
                        {isComplete && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                            Completo
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${isComplete ? 'text-green-400' : 'text-white/60'}`}>
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar
                      value={storeData.confirmed}
                      max={storeData.total}
                      color={isComplete ? 'bg-green-500' : 'bg-blue-500'}
                    />
                    <p className="text-white/40 text-[11px] mt-1">
                      {storeData.confirmed}/{storeData.total} confirmadas
                    </p>
                  </div>

                  {/* Productos */}
                  {Object.keys(storeData.products).length > 0 && (
                    <div className="px-4 pb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(storeData.products)
                          .sort((a, b) => b[1].qty - a[1].qty)
                          .map(([sku, p]) => (
                            <span
                              key={sku}
                              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70"
                            >
                              {p.name} <span className="font-bold text-primary-400">×{p.qty}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Guías */}
                  <div className="px-4 pb-3 pt-1 border-t border-white/5">
                    <p className="text-white/40 text-[10px] mb-1.5 font-medium uppercase tracking-wide">Guías</p>
                    <div className="space-y-1">
                      {visibleGuides.map((guide, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 group hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {guide.status === 'confirmed'
                              ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                              : <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                            }
                            <span className="text-white/70 text-xs font-mono truncate">{guide.guide_code}</span>
                            {guide.carrier && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300/70 border border-blue-500/20 shrink-0 hidden sm:block">
                                {guide.carrier}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-white/30 text-[10px] hidden sm:block">{guide.dispatch_number}</span>
                            <button
                              onClick={() => handleDeleteDispatch(guide.id, guide.guide_code, guide.dispatch_number)}
                              className="p-1 rounded-md text-red-400/0 group-hover:text-red-400 hover:bg-red-500/20 transition-all"
                              title="Eliminar dispatch"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sin resultados con filtros */}
        {stats.total > 0 && filteredStores.length === 0 && hasFilters && (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 text-center">
            <Search className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/50 text-sm">Sin resultados para los filtros aplicados</p>
            <button
              onClick={() => { setSearchGuide(''); setFilterCarrier('all'); setFilterStore('all'); }}
              className="mt-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-all"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* ── Resumen de Productos ── */}
        {Object.keys(stats.byProduct).length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3">
            <p className="text-xs text-white/50 font-medium mb-3 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-purple-400" />
              Resumen de Productos Despachados
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(stats.byProduct)
                .sort((a, b) => b[1].qty - a[1].qty)
                .map(([sku, product]) => (
                  <div
                    key={sku}
                    className="bg-white/5 rounded-xl border border-white/10 px-3 py-2.5 flex items-center justify-between hover:bg-white/10 transition-all"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-white text-sm font-medium truncate">{product.name}</p>
                      <p className="text-white/40 text-xs font-mono">{sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-primary-400">{product.qty}</p>
                      <p className="text-white/30 text-[10px]">uds</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default DispatchDashboard;
