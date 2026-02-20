// =====================================================
// UNIFIED DASHBOARD - Dunamix WMS
// =====================================================
// Dashboard con estadísticas de dispatches
// Selector de fecha: Hoy / Ayer / Fecha específica
// =====================================================

import { useState, useEffect } from 'react';
import { dispatchesService } from '../../services/wmsService';
import {
  Package,
  TrendingUp,
  Store,
  Box,
  BarChart3,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';

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
  // Formatear como "Lun 19 Feb"
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function UnifiedDashboard({ warehouseId = null, showTitle = true, compact = false }) {
  const todayISO = toLocalDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDispatches: 0,
    totalProducts: 0,
    byCarrier: {},
    byStore: {},
    byProduct: {}
  });

  useEffect(() => {
    loadStats(selectedDate);
  }, [warehouseId, selectedDate]);

  async function loadStats(dateISO) {
    setIsLoading(true);
    try {
      const dispatches = await dispatchesService.getDispatchesByDate(dateISO, warehouseId);
      calculateStats(dispatches);
    } catch (error) {
      console.error('❌ Error al cargar estadísticas:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(dispatches) {
    const s = {
      totalDispatches: dispatches.length,
      totalProducts: 0,
      byCarrier: {},
      byStore: {},
      byProduct: {}
    };

    dispatches.forEach(dispatch => {
      const shipmentRecord = Array.isArray(dispatch.shipment_record)
        ? dispatch.shipment_record[0]
        : dispatch.shipment_record;

      const carrier = shipmentRecord?.carriers?.display_name ||
                      dispatch.carrier_name ||
                      'Sin transportadora';
      s.byCarrier[carrier] = (s.byCarrier[carrier] || 0) + 1;

      const store = shipmentRecord?.raw_payload?.store ||
                    shipmentRecord?.raw_payload?.dropshipper ||
                    shipmentRecord?.customer_name ||
                    'Sin tienda';
      s.byStore[store] = (s.byStore[store] || 0) + 1;

      if (dispatch.dispatch_items) {
        dispatch.dispatch_items.forEach(item => {
          const qty = item.qty || 0;
          s.totalProducts += qty;

          const productKey = item.products?.sku || item.sku || 'Desconocido';
          const productName = item.products?.name || productKey;

          if (!s.byProduct[productKey]) {
            s.byProduct[productKey] = { name: productName, qty: 0 };
          }
          s.byProduct[productKey].qty += qty;
        });
      }
    });

    setStats(s);
  }

  // Navegar días
  function shiftDay(delta) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const newISO = toLocalDateISO(d);
    // No permitir fechas futuras
    if (newISO <= todayISO) setSelectedDate(newISO);
  }

  const isToday = selectedDate === todayISO;

  return (
    <div className={`space-y-3 ${compact ? 'compact-mode' : ''}`}>

      {/* Header: título + selector de fecha */}
      <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl px-4 py-3 border border-white/20 shadow-glass-lg flex items-center justify-between gap-4">
        {showTitle && (
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 shrink-0">
            <BarChart3 className="w-4 h-4 text-primary-400" />
            Estadísticas
          </h2>
        )}

        {/* Date picker compacto */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => shiftDay(-1)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <Calendar className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm font-medium text-white min-w-[80px] text-center">
              {formatDateLabel(selectedDate)}
            </span>
          </div>

          <button
            onClick={() => shiftDay(1)}
            disabled={isToday}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Input de fecha para selección directa */}
          <input
            type="date"
            value={selectedDate}
            max={todayISO}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="w-7 h-7 opacity-0 absolute cursor-pointer"
            style={{ colorScheme: 'dark' }}
            title="Seleccionar fecha"
          />
          <button
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all relative"
            title="Seleccionar fecha"
            onClick={() => {}}
          >
            <Calendar className="w-3.5 h-3.5" />
            <input
              type="date"
              value={selectedDate}
              max={todayISO}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              style={{ colorScheme: 'dark' }}
            />
          </button>

          {/* Botón "Hoy" si no estamos hoy */}
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayISO)}
              className="px-2 py-1 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs hover:bg-primary-500/30 transition-all"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border border-white/20 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
          <p className="text-white/60 text-sm">Cargando...</p>
        </div>
      ) : stats.totalDispatches === 0 ? (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border border-white/20 text-center">
          <Package className="w-10 h-10 text-white/20 mx-auto mb-2" />
          <p className="text-white/50 text-sm">Sin despachos {isToday ? 'hoy' : `el ${formatDateLabel(selectedDate)}`}</p>
        </div>
      ) : (
        <>
          {/* Stats principales — 2 cards compactas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl px-4 py-3 border border-white/20 shadow-glass-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/50 font-medium">Pedidos</p>
                <Package className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {stats.totalDispatches}
              </p>
            </div>

            <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl px-4 py-3 border border-white/20 shadow-glass-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/50 font-medium">Productos</p>
                <Box className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {stats.totalProducts}
              </p>
            </div>
          </div>

          {/* Transportadora — fila compacta */}
          {Object.keys(stats.byCarrier).length > 0 && (
            <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl px-4 py-3 border border-white/20 shadow-glass-lg">
              <p className="text-xs text-white/50 font-medium mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                Por Transportadora
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byCarrier)
                  .sort(([, a], [, b]) => b - a)
                  .map(([carrier, count], i) => (
                    <div
                      key={carrier}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${
                        i === 0
                          ? 'bg-blue-500/10 border-blue-400/20 text-blue-300'
                          : 'bg-indigo-500/10 border-indigo-400/20 text-indigo-300'
                      }`}
                    >
                      <span className="font-medium truncate max-w-[120px]" title={carrier}>{carrier}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Tiendas y Productos — grid 2 cols */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Object.keys(stats.byStore).length > 0 && (
              <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl px-4 py-3 border border-white/20 shadow-glass-lg">
                <p className="text-xs text-white/50 font-medium mb-2 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-400" />
                  Por Tienda
                </p>
                <div className="space-y-1">
                  {Object.entries(stats.byStore)
                    .sort(([, a], [, b]) => b - a)
                    .map(([store, count]) => (
                      <div
                        key={store}
                        className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10 hover:bg-white/10 transition-all"
                      >
                        <span className="text-sm text-gray-200 truncate pr-3">{store}</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent shrink-0">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {Object.keys(stats.byProduct).length > 0 && (
              <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl px-4 py-3 border border-white/20 shadow-glass-lg">
                <p className="text-xs text-white/50 font-medium mb-2 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-purple-400" />
                  Por Producto
                </p>
                <div className="space-y-1">
                  {Object.entries(stats.byProduct)
                    .sort((a, b) => b[1].qty - a[1].qty)
                    .map(([sku, product]) => (
                      <div
                        key={sku}
                        className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10 hover:bg-white/10 transition-all"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm text-white font-medium truncate">{product.name}</p>
                          <p className="text-white/40 text-xs">{sku}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-primary-400">{product.qty}</p>
                          <p className="text-white/30 text-[10px]">uds</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default UnifiedDashboard;
