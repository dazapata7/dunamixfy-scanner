// =====================================================
// DISPATCH HISTORY - Dunamix WMS
// =====================================================
// Historial completo de pedidos/despachos
// Muestra: Guía, Transportadora, Fecha Pedido, Fecha Despacho, Productos, Tienda, Cliente
// Incluye botón para eliminar (solo pruebas)
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dispatchesService } from '../../services/wmsService';
import { dunamixfyService } from '../../services/dunamixfyService';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft,
  Package,
  Calendar,
  Trash2,
  Loader2,
  Search,
  Download,
  CheckCircle,
  Filter,
  X,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isToday, isYesterday, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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

// Preset de fechas rápidas
const DATE_PRESETS = [
  { key: 'all', label: 'Todos' },
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'day_before', label: 'Antes de ayer' },
  { key: 'custom', label: 'Rango...' },
];

export function DispatchHistory({ warehouseId = null }) {
  const navigate = useNavigate();

  const [dispatches, setDispatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [showCustomDates, setShowCustomDates] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [warehouseId]);

  // Cuando cambia preset a 'custom', mostrar inputs de fechas
  useEffect(() => {
    if (datePreset === 'custom') {
      setShowCustomDates(true);
    } else {
      setShowCustomDates(false);
    }
  }, [datePreset]);

  async function loadHistory() {
    setIsLoading(true);
    try {
      const query = supabase
        .from('dispatches')
        .select(`
          *,
          dispatch_items(*, products(*)),
          shipment_record:shipment_records(*, carriers(*)),
          warehouse:warehouses(name),
          operator:operators!dispatches_operator_id_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (warehouseId) {
        query.eq('warehouse_id', warehouseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setDispatches(data);
      console.log(`✅ ${data.length} dispatches cargados en historial`);
    } catch (error) {
      console.error('❌ Error al cargar historial:', error);
      toast.error('Error al cargar historial de despachos');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmDispatch(dispatchId, dispatchNumber) {
    if (!confirm(`¿Confirmar dispatch ${dispatchNumber}?\n\nEsto actualizará el inventario y marcará el pedido como confirmado.`)) {
      return;
    }

    try {
      toast.loading('Confirmando dispatch...', { id: 'confirm' });
      await dispatchesService.confirm(dispatchId);
      toast.success('Dispatch confirmado exitosamente', { id: 'confirm' });
      await loadHistory();
    } catch (error) {
      console.error('❌ Error al confirmar dispatch:', error);
      toast.error(error.message || 'Error al confirmar dispatch', { id: 'confirm' });
    }
  }

  async function handleDeleteDispatch(dispatchId, trackingCode, dispatchNumber) {
    if (!confirm(`¿Eliminar guía ${trackingCode}?\n\nEsto es solo para pruebas. Se eliminarán todos los registros relacionados.`)) {
      return;
    }

    try {
      toast.loading('Eliminando dispatch...', { id: 'delete' });

      const { data, error } = await supabase.rpc('delete_dispatch_for_testing', {
        p_dispatch_number: dispatchNumber
      });

      if (error) throw error;

      if (data && data.length > 0 && data[0].success) {
        console.log(`✅ Dispatch ${dispatchNumber} eliminado. RPC response:`, data[0]);
        setDispatches(prev => prev.filter(d => d.id !== dispatchId));

        const dunamixfyResponse = await dunamixfyService.markOrderAsUnscanned(trackingCode);
        if (dunamixfyResponse.success) {
          console.log(`✅ Guía ${trackingCode} marcada como unscanned en Dunamixfy`);
        } else {
          console.warn(`⚠️ No se pudo marcar como unscanned en Dunamixfy:`, dunamixfyResponse.message);
        }

        toast.success('Dispatch eliminado exitosamente', { id: 'delete' });
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadHistory();
      } else {
        console.error('❌ RPC no retornó éxito:', data);
        toast.error('Error: ' + (data?.[0]?.message || 'No se encontró el dispatch'), { id: 'delete' });
      }
    } catch (error) {
      console.error('❌ Error al eliminar dispatch:', error);
      toast.error(error.message || 'Error al eliminar dispatch', { id: 'delete' });
    }
  }

  // Lista de transportadoras únicas en los datos cargados
  const availableCarriers = useMemo(() => {
    const seen = new Set();
    const carriers = [];
    for (const d of dispatches) {
      const name = d.shipment_record?.carriers?.display_name;
      if (name && !seen.has(name)) {
        seen.add(name);
        carriers.push(name);
      }
    }
    return carriers.sort();
  }, [dispatches]);

  // Filtrado combinado
  const filteredDispatches = useMemo(() => {
    return dispatches.filter(dispatch => {
      const createdAt = new Date(dispatch.created_at);

      // Filtro de fecha
      if (datePreset === 'today') {
        if (!isToday(createdAt)) return false;
      } else if (datePreset === 'yesterday') {
        if (!isYesterday(createdAt)) return false;
      } else if (datePreset === 'day_before') {
        const dayBefore = subDays(new Date(), 2);
        const start = startOfDay(dayBefore);
        const end = endOfDay(dayBefore);
        if (createdAt < start || createdAt > end) return false;
      } else if (datePreset === 'custom') {
        if (customDateFrom) {
          const from = startOfDay(parseISO(customDateFrom));
          if (createdAt < from) return false;
        }
        if (customDateTo) {
          const to = endOfDay(parseISO(customDateTo));
          if (createdAt > to) return false;
        }
      }

      // Filtro de transportadora
      if (selectedCarrier !== 'all') {
        const carrierName = dispatch.shipment_record?.carriers?.display_name || '';
        if (carrierName !== selectedCarrier) return false;
      }

      // Filtro de texto (guía, cliente, tienda, transportadora)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          dispatch.guide_code?.toLowerCase().includes(q) ||
          dispatch.dispatch_number?.toLowerCase().includes(q) ||
          dispatch.shipment_record?.raw_payload?.customer_name?.toLowerCase().includes(q) ||
          dispatch.shipment_record?.raw_payload?.store?.toLowerCase().includes(q) ||
          dispatch.shipment_record?.carriers?.display_name?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [dispatches, datePreset, customDateFrom, customDateTo, selectedCarrier, searchTerm]);

  const hasActiveFilters = datePreset !== 'all' || selectedCarrier !== 'all' || searchTerm.trim() !== '';

  function clearFilters() {
    setDatePreset('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setSelectedCarrier('all');
    setSearchTerm('');
  }

  function handleExportCSV() {
    const rows = filteredDispatches.map(d => ({
      Guia:          d.guide_code || d.dispatch_number || '',
      Transportadora: d.shipment_record?.carriers?.display_name || '',
      Tienda:        d.shipment_record?.raw_payload?.store || '',
      Cliente:       d.shipment_record?.raw_payload?.customer_name || '',
      Bodega:        d.warehouse?.name || '',
      Operador:      d.operator?.name || '',
      Estado:        d.status || '',
      Fecha:         d.created_at ? format(new Date(d.created_at), 'yyyy-MM-dd HH:mm', { locale: es }) : '',
      Productos:     (d.dispatch_items || []).map(i => `${i.products?.name || ''} x${i.quantity}`).join(' | '),
    }));
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(rows, `historial_despachos_${date}.csv`);
    toast.success(`${rows.length} despachos exportados`);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto">

        {/* Header – solo móvil */}
        <div className="lg:hidden mb-4 flex items-center gap-3">
          <button onClick={() => navigate('/wms')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h1 className="text-xl font-bold text-white">Historial de Pedidos</h1>
        </div>

        {/* ── Filtros ──────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-4 space-y-3">

          <div className="flex flex-wrap gap-3 items-center">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input type="text" placeholder="Buscar por guía, cliente, tienda..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary-500/50 transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Presets fecha */}
            <div className="flex gap-1 flex-wrap">
              {DATE_PRESETS.map(p => (
                <button key={p.key} onClick={() => setDatePreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    datePreset === p.key ? 'bg-primary-500 text-white' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Transportadora */}
            {availableCarriers.length > 0 && (
              <div className="relative">
                <select value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/80 focus:outline-none focus:border-primary-500/50 transition-all"
                  style={{ colorScheme: 'dark' }}>
                  <option value="all">Todas las transportadoras</option>
                  {availableCarriers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
              </div>
            )}

            {/* Limpiar */}
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-sm">
                <X className="w-4 h-4" /> Limpiar
              </button>
            )}

            {/* CSV */}
            <button onClick={handleExportCSV} disabled={filteredDispatches.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm disabled:opacity-40">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          {/* Rango personalizado */}
          {showCustomDates && (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-white/40 text-xs">Desde:</span>
              <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary-500/50"
                style={{ colorScheme: 'dark' }} />
              <span className="text-white/40 text-xs">Hasta:</span>
              <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary-500/50"
                style={{ colorScheme: 'dark' }} />
            </div>
          )}

          {/* Contador */}
          <div className="text-white/40 text-xs">
            {filteredDispatches.length} de {dispatches.length} pedidos
            {hasActiveFilters && <span className="ml-1.5 text-primary-400">• filtros activos</span>}
          </div>
        </div>

        {/* ── DESKTOP: tabla ─────────────────────── */}
        {filteredDispatches.length === 0 ? (
          <div className="bg-white/5 rounded-2xl border border-white/10 p-16 text-center">
            <Package className="w-14 h-14 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">{hasActiveFilters ? 'No hay pedidos con los filtros seleccionados' : 'No hay pedidos en el historial'}</p>
            {hasActiveFilters && <button onClick={clearFilters} className="mt-3 text-primary-400 text-sm hover:underline">Limpiar filtros</button>}
          </div>
        ) : (
          <>
            {/* Tabla desktop */}
            <div className="hidden lg:block bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Guía</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-28">Estado</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-40">Transportadora</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Tienda</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Productos</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-36">Fecha</th>
                    <th className="px-4 py-3 text-center text-white/40 font-medium text-xs uppercase tracking-wider w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredDispatches.map(dispatch => {
                    const customerName = dispatch.shipment_record?.raw_payload?.customer_name || '—';
                    const storeName    = dispatch.shipment_record?.raw_payload?.store || dispatch.shipment_record?.raw_payload?.dropshipper || '—';
                    const carrierName  = dispatch.shipment_record?.carriers?.display_name || '—';
                    const isDraft      = dispatch.status !== 'confirmed';
                    return (
                      <tr key={dispatch.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-white/90 font-medium text-xs">{dispatch.guide_code}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            isDraft ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
                          }`}>
                            {isDraft ? 'BORRADOR' : 'CONFIRMADO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/70 text-xs truncate max-w-[140px]">{carrierName}</td>
                        <td className="px-4 py-3 text-white/70 text-xs truncate max-w-[140px]" title={storeName}>{storeName}</td>
                        <td className="px-4 py-3 text-white/70 text-xs truncate max-w-[160px]" title={customerName}>{customerName}</td>
                        <td className="px-4 py-3 text-white/50 text-xs max-w-[220px]">
                          <div className="truncate">
                            {(dispatch.dispatch_items || []).map((item, i) => (
                              <span key={i}>{item.products?.name || 'Prod.'} <span className="text-white/30">×{item.qty || item.quantity}</span>{i < dispatch.dispatch_items.length - 1 ? ' · ' : ''}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">
                          {format(new Date(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isDraft && (
                              <button onClick={() => handleConfirmDispatch(dispatch.id, dispatch.dispatch_number)}
                                className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-all" title="Confirmar">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDeleteDispatch(dispatch.id, dispatch.guide_code, dispatch.dispatch_number)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards móvil */}
            <div className="lg:hidden space-y-2">
              {filteredDispatches.map(dispatch => {
                const customerName = dispatch.shipment_record?.raw_payload?.customer_name || '—';
                const storeName    = dispatch.shipment_record?.raw_payload?.store || dispatch.shipment_record?.raw_payload?.dropshipper || '—';
                const carrierName  = dispatch.shipment_record?.carriers?.display_name || '—';
                const isDraft      = dispatch.status !== 'confirmed';
                return (
                  <div key={dispatch.id} className="bg-white/5 rounded-xl border border-white/10 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white font-bold text-sm font-mono truncate">{dispatch.guide_code}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          isDraft ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
                        }`}>{isDraft ? 'BORRADOR' : 'CONFIRMADO'}</span>
                      </div>
                      <div className="flex gap-1">
                        {isDraft && (
                          <button onClick={() => handleConfirmDispatch(dispatch.id, dispatch.dispatch_number)}
                            className="p-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteDispatch(dispatch.id, dispatch.guide_code, dispatch.dispatch_number)}
                          className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                      <div><p className="text-white/40">Transportadora</p><p className="text-white truncate">{carrierName}</p></div>
                      <div><p className="text-white/40">Tienda</p><p className="text-white truncate">{storeName}</p></div>
                      <div><p className="text-white/40">Cliente</p><p className="text-white truncate">{customerName}</p></div>
                      <div><p className="text-white/40">Fecha</p><p className="text-white">{format(new Date(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: es })}</p></div>
                    </div>
                    <div className="pt-2 border-t border-white/10 text-xs text-white/60">
                      {(dispatch.dispatch_items || []).map((item, i) => (
                        <span key={i}>{item.products?.name} <span className="text-white/40">×{item.qty || item.quantity}</span>{i < dispatch.dispatch_items.length - 1 ? ' · ' : ''}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DispatchHistory;
