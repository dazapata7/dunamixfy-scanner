// =====================================================
// UNIFIED DASHBOARD - Dunamix WMS
// =====================================================
// Dashboard único con estadísticas de dispatches
// Muestra: Total Pedidos, Por Transportadora, Total Productos, Por Tiendas, Desgloce de Productos
// Componente reutilizable (aparece en Dashboard principal y WMS)
// =====================================================

import { useState, useEffect } from 'react';
import { dispatchesService } from '../../services/wmsService';
import {
  Package,
  TrendingUp,
  Store,
  Box,
  BarChart3,
  Loader2
} from 'lucide-react';

export function UnifiedDashboard({ warehouseId = null, showTitle = true, compact = false }) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDispatches: 0,
    totalProducts: 0,
    byCarrier: {},
    byStore: {},
    byProduct: {}
  });

  useEffect(() => {
    loadTodayStats();
  }, [warehouseId]);

  async function loadTodayStats() {
    setIsLoading(true);
    try {
      // Si hay warehouseId, filtrar por almacén; si no, traer todos los dispatches del día
      const dispatches = warehouseId
        ? await dispatchesService.getTodayDispatches(warehouseId)
        : await dispatchesService.getAllTodayDispatches();

      calculateStats(dispatches);
    } catch (error) {
      console.error('❌ Error al cargar estadísticas:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(dispatches) {
    const stats = {
      totalDispatches: dispatches.length,
      totalProducts: 0,
      byCarrier: {},
      byStore: {},
      byProduct: {}
    };

    dispatches.forEach(dispatch => {
      // shipment_record puede ser array o objeto, normalizamos
      const shipmentRecord = Array.isArray(dispatch.shipment_record)
        ? dispatch.shipment_record[0]
        : dispatch.shipment_record;

      // DEBUG: Log para ver qué datos tenemos
      if (!shipmentRecord) {
        console.warn('⚠️ Dispatch sin shipment_record:', dispatch.dispatch_number);
      }

      // Obtener transportadora (buscar en varias ubicaciones)
      const carrier = shipmentRecord?.carriers?.display_name ||
                      dispatch.carrier_name ||
                      'Sin transportadora';

      // Agrupar por transportadora
      stats.byCarrier[carrier] = (stats.byCarrier[carrier] || 0) + 1;

      // Extraer tienda del raw_payload
      const store = shipmentRecord?.raw_payload?.store ||
                    shipmentRecord?.raw_payload?.dropshipper ||
                    shipmentRecord?.customer_name ||
                    'Sin tienda';

      // Agrupar por tienda
      stats.byStore[store] = (stats.byStore[store] || 0) + 1;

      // Contar productos
      if (dispatch.dispatch_items) {
        dispatch.dispatch_items.forEach(item => {
          const qty = item.qty || 0;
          stats.totalProducts += qty;

          // Agrupar por producto (usando SKU como key)
          const productKey = item.products?.sku || item.sku || 'Desconocido';
          const productName = item.products?.name || productKey;

          if (!stats.byProduct[productKey]) {
            stats.byProduct[productKey] = {
              name: productName,
              qty: 0
            };
          }
          stats.byProduct[productKey].qty += qty;
        });
      }
    });

    setStats(stats);
  }

  if (isLoading) {
    return (
      <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-white/60 ml-3">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? 'compact-mode' : ''}`}>
      {/* Title (opcional) */}
      {showTitle && (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-primary-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-400" />
            </div>
            <span>Resumen de Hoy</span>
          </h2>
        </div>
      )}

      {/* Total Pedidos Escaneados */}
      <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white/60 font-medium">Total Pedidos Escaneados</p>
          <Package className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          {stats.totalDispatches}
        </p>
      </div>

      {/* Desgloce por Transportadora */}
      {Object.keys(stats.byCarrier).length > 0 && (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Desgloce por Transportadora
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.byCarrier)
              .sort(([, a], [, b]) => b - a)
              .map(([carrier, count], index) => (
                <div
                  key={carrier}
                  className={`backdrop-blur-xl rounded-2xl p-4 border shadow-glass ${
                    index === 0
                      ? 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-400/20'
                      : 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-400/20'
                  }`}
                >
                  <p className="text-sm text-gray-300 mb-1 font-medium truncate" title={carrier}>
                    {carrier}
                  </p>
                  <p className="text-3xl font-bold text-white">{count}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Total Productos */}
      <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white/60 font-medium">Total Productos Despachados</p>
          <Box className="w-5 h-5 text-purple-400" />
        </div>
        <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {stats.totalProducts}
        </p>
      </div>

      {/* Pedidos por Tiendas */}
      {Object.keys(stats.byStore).length > 0 && (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-400" />
            Pedidos por Tiendas
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byStore)
              .sort(([, a], [, b]) => b - a)
              .map(([store, count]) => (
                <div
                  key={store}
                  className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/10 hover:bg-white/10 transition-all"
                >
                  <span className="text-gray-200 font-medium">{store}</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Desgloce por Productos */}
      {Object.keys(stats.byProduct).length > 0 && (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-glass-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Box className="w-5 h-5 text-purple-400" />
            Desgloce por Productos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(stats.byProduct)
              .sort((a, b) => b[1].qty - a[1].qty)  // Ordenar por cantidad DESC
              .map(([sku, product]) => (
                <div
                  key={sku}
                  className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-white font-medium truncate">{product.name}</p>
                    <p className="text-white/40 text-sm">{sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-400">{product.qty}</p>
                    <p className="text-white/40 text-xs">uds</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Si no hay datos */}
      {stats.totalDispatches === 0 && (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-8 border border-white/20 shadow-glass-lg text-center">
          <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">No hay pedidos escaneados hoy</p>
        </div>
      )}
    </div>
  );
}

export default UnifiedDashboard;
