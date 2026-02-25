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
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Cargando historial...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/wms')}
            className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <h1 className="text-2xl font-bold text-white flex-1 text-center">
            📋 Historial de Pedidos
          </h1>

          <div className="w-[100px]"></div>
        </div>

        {/* Filtros */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-glass-lg mb-6 space-y-3">

          {/* Búsqueda por guía / cliente */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por guía, cliente, tienda..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-primary-500/50 transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros de fecha + transportadora */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Presets de fecha */}
            <div className="flex gap-1 flex-wrap">
              {DATE_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  onClick={() => setDatePreset(preset.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    datePreset === preset.key
                      ? 'bg-primary-500 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Separador */}
            <div className="w-px h-5 bg-white/10 hidden md:block" />

            {/* Filtro de transportadora */}
            {availableCarriers.length > 0 && (
              <div className="relative">
                <select
                  value={selectedCarrier}
                  onChange={e => setSelectedCarrier(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 focus:outline-none focus:border-primary-500/50 transition-all cursor-pointer"
                >
                  <option value="all">Todas las transportadoras</option>
                  {availableCarriers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
              </div>
            )}

            {/* Limpiar filtros */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>

          {/* Inputs de rango personalizado */}
          {showCustomDates && (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-white/40 text-xs">Desde:</span>
              <input
                type="date"
                value={customDateFrom}
                onChange={e => setCustomDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary-500/50 transition-all"
              />
              <span className="text-white/40 text-xs">Hasta:</span>
              <input
                type="date"
                value={customDateTo}
                onChange={e => setCustomDateTo(e.target.value)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary-500/50 transition-all"
              />
            </div>
          )}

          {/* Resumen de resultados + CSV */}
          <div className="flex items-center gap-3">
            <p className="text-white/40 text-xs">
              {filteredDispatches.length} de {dispatches.length} pedidos
              {hasActiveFilters && <span className="ml-1 text-primary-400">• filtros activos</span>}
            </p>
            <button
              onClick={handleExportCSV}
              disabled={filteredDispatches.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Lista de dispatches */}
        <div className="space-y-3">
          {filteredDispatches.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
              <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/60">
                {hasActiveFilters ? 'No hay pedidos con los filtros seleccionados' : 'No hay pedidos en el historial'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 text-primary-400 text-sm hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            filteredDispatches.map((dispatch) => {
              const customerName = dispatch.shipment_record?.raw_payload?.customer_name || 'N/A';
              const storeName = dispatch.shipment_record?.raw_payload?.store ||
                                dispatch.shipment_record?.raw_payload?.dropshipper ||
                                'Sin tienda';
              const carrierName = dispatch.shipment_record?.carriers?.display_name || 'Sin transportadora';
              const isDraft = dispatch.status !== 'confirmed';

              return (
                <div
                  key={dispatch.id}
                  className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-3 shadow-glass-lg hover:bg-white/10 transition-all"
                >
                  {/* Compact Header: Guía + Status + Actions */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-white font-bold text-sm font-mono truncate">
                        📦 {dispatch.guide_code}
                      </span>

                      {/* Status Badge - CORRECTO: isDraft = borrador, !isDraft = confirmado */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                        isDraft
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}>
                        {isDraft ? 'BORRADOR' : 'CONFIRMADO'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {isDraft && (
                        <button
                          onClick={() => handleConfirmDispatch(dispatch.id, dispatch.dispatch_number)}
                          className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/30 text-green-400 transition-all"
                          title="Confirmar dispatch"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDispatch(dispatch.id, dispatch.guide_code, dispatch.dispatch_number)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Compact Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-white/40 mb-0.5">🚚 Transportadora</p>
                      <p className="text-white font-medium truncate" title={carrierName}>{carrierName}</p>
                    </div>
                    <div>
                      <p className="text-white/40 mb-0.5">🏪 Tienda</p>
                      <p className="text-white font-medium truncate" title={storeName}>{storeName}</p>
                    </div>
                    <div>
                      <p className="text-white/40 mb-0.5">👤 Cliente</p>
                      <p className="text-white font-medium truncate" title={customerName}>{customerName}</p>
                    </div>
                    <div>
                      <p className="text-white/40 mb-0.5">📅 Fecha</p>
                      <p className="text-white font-medium">
                        {format(new Date(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Productos */}
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-white/40 text-[10px] mb-1">📦 Productos ({dispatch.dispatch_items?.length || 0})</p>
                    <div className="text-xs text-white/80">
                      {dispatch.dispatch_items?.map((item, idx) => (
                        <span key={idx}>
                          {item.products?.name || 'Producto'} <span className="text-white/60">x{item.qty}</span>
                          {idx < dispatch.dispatch_items.length - 1 && <span className="text-white/40"> • </span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

export default DispatchHistory;
