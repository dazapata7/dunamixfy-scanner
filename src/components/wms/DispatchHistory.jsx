// =====================================================
// DISPATCH HISTORY - Dunamixfy WMS
// =====================================================
// Historial completo de pedidos/despachos
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dispatchesService } from '../../services/wmsService';
import { dunamixfyService } from '../../services/dunamixfyService';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft, Package, Trash2, Loader2,
  Search, Download, CheckCircle, X, ChevronDown
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
  { key: 'all',       label: 'Todos' },
  { key: 'today',     label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'day_before',label: 'Antes de ayer' },
  { key: 'custom',    label: 'Rango...' },
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

  useEffect(() => { loadHistory(); }, [warehouseId]);

  useEffect(() => {
    setShowCustomDates(datePreset === 'custom');
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

      if (warehouseId) query.eq('warehouse_id', warehouseId);

      const { data, error } = await query;
      if (error) throw error;

      setDispatches(data);
    } catch (error) {
      console.error('❌ Error al cargar historial:', error);
      toast.error('Error al cargar historial de despachos');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmDispatch(dispatchId, dispatchNumber) {
    if (!confirm(`¿Confirmar dispatch ${dispatchNumber}?\n\nEsto actualizará el inventario y marcará el pedido como confirmado.`)) return;
    try {
      toast.loading('Confirmando dispatch...', { id: 'confirm' });
      await dispatchesService.confirm(dispatchId);
      toast.success('Dispatch confirmado exitosamente', { id: 'confirm' });
      await loadHistory();
    } catch (error) {
      toast.error(error.message || 'Error al confirmar dispatch', { id: 'confirm' });
    }
  }

  async function handleDeleteDispatch(dispatchId, trackingCode, dispatchNumber) {
    if (!confirm(`¿Eliminar guía ${trackingCode}?\n\nEsto es solo para pruebas. Se eliminarán todos los registros relacionados.`)) return;
    try {
      toast.loading('Eliminando dispatch...', { id: 'delete' });
      const { data, error } = await supabase.rpc('delete_dispatch_for_testing', { p_dispatch_number: dispatchNumber });
      if (error) throw error;

      if (data?.[0]?.success) {
        setDispatches(prev => prev.filter(d => d.id !== dispatchId));
        if (trackingCode) {
          const dunamixfyResponse = await dunamixfyService.markOrderAsUnscanned(trackingCode);
          if (!dunamixfyResponse.success) console.warn(`⚠️ No se pudo marcar como unscanned:`, dunamixfyResponse.message);
        }
        toast.success('Dispatch eliminado exitosamente', { id: 'delete' });
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadHistory();
      } else {
        toast.error('Error: ' + (data?.[0]?.message || 'No se encontró el dispatch'), { id: 'delete' });
      }
    } catch (error) {
      toast.error(error.message || 'Error al eliminar dispatch', { id: 'delete' });
    }
  }

  const availableCarriers = useMemo(() => {
    const seen = new Set();
    const carriers = [];
    for (const d of dispatches) {
      const name = d.shipment_record?.carriers?.display_name;
      if (name && !seen.has(name)) { seen.add(name); carriers.push(name); }
    }
    return carriers.sort();
  }, [dispatches]);

  const filteredDispatches = useMemo(() => {
    return dispatches.filter(dispatch => {
      const createdAt = new Date(dispatch.created_at);

      if (datePreset === 'today') { if (!isToday(createdAt)) return false; }
      else if (datePreset === 'yesterday') { if (!isYesterday(createdAt)) return false; }
      else if (datePreset === 'day_before') {
        const dayBefore = subDays(new Date(), 2);
        if (createdAt < startOfDay(dayBefore) || createdAt > endOfDay(dayBefore)) return false;
      } else if (datePreset === 'custom') {
        if (customDateFrom && createdAt < startOfDay(parseISO(customDateFrom))) return false;
        if (customDateTo   && createdAt > endOfDay(parseISO(customDateTo)))     return false;
      }

      if (selectedCarrier !== 'all') {
        if ((dispatch.shipment_record?.carriers?.display_name || '') !== selectedCarrier) return false;
      }

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
      Guia:           d.guide_code || d.dispatch_number || '',
      Transportadora: d.shipment_record?.carriers?.display_name || '',
      Tienda:         d.shipment_record?.raw_payload?.store || '',
      Cliente:        d.shipment_record?.raw_payload?.customer_name || '',
      Bodega:         d.warehouse?.name || '',
      Operador:       d.operator?.name || '',
      Estado:         d.status || '',
      Fecha:          d.created_at ? format(new Date(d.created_at), 'yyyy-MM-dd HH:mm', { locale: es }) : '',
      Productos:      (d.dispatch_items || []).map(i => `${i.products?.name || ''} x${i.quantity}`).join(' | '),
    }));
    downloadCSV(rows, `historial_despachos_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`${rows.length} despachos exportados`);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* Header – solo móvil */}
        <div className="lg:hidden flex items-center gap-3">
          <button onClick={() => navigate('/wms')}
            className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h1 className="text-lg font-bold text-white">Historial de Pedidos</h1>
        </div>

        {/* ── Filtros ──────────────────────────── */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-4 space-y-2.5">

          <div className="flex flex-wrap gap-2 items-center">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input type="text" placeholder="Buscar por guía, cliente, tienda..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full pl-9 pr-8"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Presets fecha */}
            <div className="flex gap-1 flex-wrap">
              {DATE_PRESETS.map(p => (
                <button key={p.key} onClick={() => setDatePreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    datePreset === p.key
                      ? 'bg-primary-500/10 text-primary-400/80 border border-primary-500/20'
                      : 'bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.07]'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Transportadora */}
            {availableCarriers.length > 0 && (
              <div className="relative">
                <select value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)}
                  className="appearance-none bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/70 focus:outline-none focus:border-primary-500/40 transition-all pl-3 pr-8 py-2"
                  style={{ colorScheme: 'dark' }}>
                  <option value="all">Todas las transportadoras</option>
                  {availableCarriers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
              </div>
            )}

            {/* Limpiar */}
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="bg-red-500/[0.08] border border-red-500/[0.15] text-red-400/70 hover:bg-red-500/[0.15] hover:text-red-400 px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm">
                <X className="w-4 h-4" /> Limpiar
              </button>
            )}

            {/* CSV */}
            <button onClick={handleExportCSV} disabled={filteredDispatches.length === 0}
              className="bg-primary-500/[0.08] border border-primary-500/20 text-primary-400/80 hover:text-primary-400 hover:bg-primary-500/15 px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm disabled:opacity-30">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>

          {/* Rango personalizado */}
          {showCustomDates && (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-white/30 text-xs">Desde:</span>
              <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white/70 focus:outline-none focus:border-primary-500/40 px-3 py-1.5"
                style={{ colorScheme: 'dark' }} />
              <span className="text-white/30 text-xs">Hasta:</span>
              <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white/70 focus:outline-none focus:border-primary-500/40 px-3 py-1.5"
                style={{ colorScheme: 'dark' }} />
            </div>
          )}

          {/* Contador */}
          <div className="text-white/30 text-xs">
            {filteredDispatches.length} de {dispatches.length} pedidos
            {hasActiveFilters && <span className="ml-1.5 text-primary-400/70">· filtros activos</span>}
          </div>
        </div>

        {/* ── Vacío ──────────────────────────────── */}
        {filteredDispatches.length === 0 ? (
          <div className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl">
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">{hasActiveFilters ? 'No hay pedidos con los filtros seleccionados' : 'No hay pedidos en el historial'}</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 text-primary-400/70 text-sm hover:text-primary-400 transition-colors">
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── DESKTOP: tabla ─────────────────────── */}
            <div className="hidden lg:block bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-black/20">
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Guía</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-28">Estado</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-36">Transportadora</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Tienda</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Cliente</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Productos</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-36">Fecha</th>
                    <th className="px-4 py-3 text-center text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-20">Acc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredDispatches.map(dispatch => {
                    const customerName = dispatch.shipment_record?.raw_payload?.customer_name || '—';
                    const storeName    = dispatch.shipment_record?.raw_payload?.store || dispatch.shipment_record?.raw_payload?.dropshipper || '—';
                    const carrierName  = dispatch.shipment_record?.carriers?.display_name || '—';
                    const isDraft      = dispatch.status !== 'confirmed';
                    return (
                      <tr key={dispatch.id} className="hover:bg-primary-500/[0.03] transition-colors group">
                        <td className="px-4 py-3 font-mono text-white/80 text-xs font-medium">{dispatch.guide_code}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            isDraft
                              ? 'bg-orange-500/10 text-orange-400/80 border-orange-500/20'
                              : 'bg-primary-500/10 text-primary-400/80 border-primary-500/20'
                          }`}>
                            {isDraft ? 'BORRADOR' : 'CONFIRMADO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-sm truncate max-w-[130px]">{carrierName}</td>
                        <td className="px-4 py-3 text-white/60 text-sm truncate max-w-[140px]" title={storeName}>{storeName}</td>
                        <td className="px-4 py-3 text-white/60 text-sm truncate max-w-[160px]" title={customerName}>{customerName}</td>
                        <td className="px-4 py-3 text-white/40 text-sm max-w-[220px]">
                          <div className="truncate">
                            {(dispatch.dispatch_items || []).map((item, i) => (
                              <span key={i}>
                                {item.products?.name || 'Prod.'}
                                <span className="text-white/25"> ×{item.qty || item.quantity}</span>
                                {i < dispatch.dispatch_items.length - 1 ? <span className="text-white/20"> · </span> : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-sm whitespace-nowrap">
                          {format(new Date(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isDraft && (
                              <button onClick={() => handleConfirmDispatch(dispatch.id, dispatch.dispatch_number)}
                                className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-primary-400 hover:bg-primary-500/10 hover:border-primary-500/20 transition-all" title="Confirmar">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDeleteDispatch(dispatch.id, dispatch.guide_code, dispatch.dispatch_number)}
                              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] transition-all" title="Eliminar">
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

            {/* ── Cards móvil ──────────────────────── */}
            <div className="lg:hidden space-y-2">
              {filteredDispatches.map(dispatch => {
                const customerName = dispatch.shipment_record?.raw_payload?.customer_name || '—';
                const storeName    = dispatch.shipment_record?.raw_payload?.store || dispatch.shipment_record?.raw_payload?.dropshipper || '—';
                const carrierName  = dispatch.shipment_record?.carriers?.display_name || '—';
                const isDraft      = dispatch.status !== 'confirmed';
                return (
                  <div key={dispatch.id} className="bg-dark-800 rounded-2xl border border-white/[0.08] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white font-bold text-sm font-mono truncate">{dispatch.guide_code}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          isDraft
                            ? 'bg-orange-500/10 text-orange-400/80 border-orange-500/20'
                            : 'bg-primary-500/10 text-primary-400/80 border-primary-500/20'
                        }`}>{isDraft ? 'BORRADOR' : 'CONFIRMADO'}</span>
                      </div>
                      <div className="flex gap-1">
                        {isDraft && (
                          <button onClick={() => handleConfirmDispatch(dispatch.id, dispatch.dispatch_number)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-primary-400 hover:bg-primary-500/10 transition-all">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteDispatch(dispatch.id, dispatch.guide_code, dispatch.dispatch_number)}
                          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                      <div><p className="text-white/30 mb-0.5">Transportadora</p><p className="text-white/60 truncate">{carrierName}</p></div>
                      <div><p className="text-white/30 mb-0.5">Tienda</p><p className="text-white/60 truncate">{storeName}</p></div>
                      <div><p className="text-white/30 mb-0.5">Cliente</p><p className="text-white/60 truncate">{customerName}</p></div>
                      <div><p className="text-white/30 mb-0.5">Fecha</p><p className="text-white/60">{format(new Date(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: es })}</p></div>
                    </div>
                    <div className="pt-2 border-t border-white/[0.05] text-xs text-white/40">
                      {(dispatch.dispatch_items || []).map((item, i) => (
                        <span key={i}>{item.products?.name} <span className="text-white/25">×{item.qty || item.quantity}</span>{i < dispatch.dispatch_items.length - 1 ? ' · ' : ''}</span>
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
