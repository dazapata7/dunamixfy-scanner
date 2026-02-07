// =====================================================
// DISPATCH DASHBOARD - Dunamix WMS
// =====================================================
// Dashboard de despachos del día
// Muestra pedidos por tienda/dropshipper y resumen de productos
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { dispatchesService } from '../../services/wmsService';
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
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

export function DispatchDashboard() {
  const navigate = useNavigate();
  const { selectedWarehouse } = useStore();

  const [dispatches, setDispatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDispatches: 0,
    confirmedDispatches: 0,
    totalProducts: 0,
    byStore: {},
    byProduct: {}
  });

  // Verificar almacén seleccionado
  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
    } else {
      loadTodayDispatches();
    }
  }, [selectedWarehouse, navigate]);

  async function loadTodayDispatches() {
    setIsLoading(true);
    try {
      // Obtener despachos del día actual
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const data = await dispatchesService.getTodayDispatches(selectedWarehouse.id);

      setDispatches(data);
      calculateStats(data);

    } catch (error) {
      console.error('❌ Error al cargar despachos:', error);
      toast.error('Error al cargar despachos del día');
    } finally {
      setIsLoading(false);
    }
  }

  // Función para eliminar dispatch (para pruebas)
  async function handleDeleteDispatch(trackingCode, dispatchNumber) {
    if (!confirm(`¿Eliminar guía ${trackingCode}?\n\nEsto es solo para pruebas. Se eliminarán todos los registros relacionados.`)) {
      return;
    }

    try {
      toast.loading('Eliminando dispatch...', { id: 'delete' });

      // Llamar a la función RPC de eliminación
      const { data, error } = await supabase.rpc('delete_dispatch_for_testing', {
        p_tracking_code: trackingCode
      });

      if (error) throw error;

      if (data && data.length > 0 && data[0].success) {
        // Eliminar del estado local inmediatamente
        setDispatches(prev => prev.filter(d => d.guide_code !== trackingCode));

        toast.success('Dispatch eliminado exitosamente', { id: 'delete' });

        // Recargar dispatches desde BD
        await loadTodayDispatches();
      } else {
        toast.error('No se encontró el dispatch', { id: 'delete' });
      }
    } catch (error) {
      console.error('❌ Error al eliminar dispatch:', error);
      toast.error(error.message || 'Error al eliminar dispatch', { id: 'delete' });
    }
  }

  function calculateStats(dispatches) {
    const stats = {
      totalDispatches: dispatches.length,
      confirmedDispatches: 0,
      totalProducts: 0,
      byStore: {},
      byProduct: {}
    };

    dispatches.forEach(dispatch => {
      // Contar confirmados
      if (dispatch.status === 'confirmed') {
        stats.confirmedDispatches++;
      }

      // Extraer tienda del raw_payload
      const store = dispatch.shipment_record?.raw_payload?.store ||
                    dispatch.shipment_record?.raw_payload?.dropshipper ||
                    'Sin tienda';

      // Agrupar por tienda
      if (!stats.byStore[store]) {
        stats.byStore[store] = {
          total: 0,
          confirmed: 0,
          products: {},
          guides: []  // Lista de guías por tienda
        };
      }

      stats.byStore[store].total++;
      if (dispatch.status === 'confirmed') {
        stats.byStore[store].confirmed++;
      }

      // Agregar guía a la lista
      stats.byStore[store].guides.push({
        guide_code: dispatch.guide_code,
        dispatch_number: dispatch.dispatch_number,
        status: dispatch.status,
        confirmed_at: dispatch.confirmed_at
      });

      // Contar productos
      if (dispatch.dispatch_items) {
        dispatch.dispatch_items.forEach(item => {
          const qty = item.qty || 0;
          stats.totalProducts += qty;

          // Por tienda
          const productKey = item.product?.sku || item.sku || 'Desconocido';
          if (!stats.byStore[store].products[productKey]) {
            stats.byStore[store].products[productKey] = {
              name: item.product?.name || productKey,
              qty: 0
            };
          }
          stats.byStore[store].products[productKey].qty += qty;

          // Global
          if (!stats.byProduct[productKey]) {
            stats.byProduct[productKey] = {
              name: item.product?.name || productKey,
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
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Cargando despachos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <button
          onClick={() => navigate('/wms')}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Title Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-blue-500/20">
              <BarChart3 className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Dashboard de Despachos
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {selectedWarehouse?.name} - {new Date().toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={loadTodayDispatches}
              className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Despachos */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-sm">Total Despachos</p>
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalDispatches}</p>
          </div>

          {/* Confirmados */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-sm">Confirmados</p>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-green-400">{stats.confirmedDispatches}</p>
          </div>

          {/* Pendientes */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-sm">Pendientes</p>
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-3xl font-bold text-orange-400">
              {stats.totalDispatches - stats.confirmedDispatches}
            </p>
          </div>

          {/* Total Productos */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-sm">Total Productos</p>
              <Box className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-purple-400">{stats.totalProducts}</p>
          </div>
        </div>

        {/* Despachos por Tienda/Dropshipper */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-400" />
            Despachos por Tienda / Dropshipper
          </h2>

          {Object.keys(stats.byStore).length === 0 ? (
            <p className="text-white/40 text-center py-8">
              No hay despachos registrados hoy
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats.byStore).map(([storeName, storeData]) => (
                <div
                  key={storeName}
                  className="bg-white/5 rounded-2xl border border-white/10 p-4"
                >
                  {/* Store Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-white font-medium">{storeName}</h3>
                      <p className="text-white/60 text-sm">
                        {storeData.confirmed} de {storeData.total} confirmados
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`
                        px-3 py-1 rounded-lg text-sm font-medium
                        ${storeData.confirmed === storeData.total
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-orange-500/20 text-orange-300'
                        }
                      `}>
                        {Math.round((storeData.confirmed / storeData.total) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Products by Store */}
                  <div className="space-y-2 mb-3">
                    {Object.entries(storeData.products).map(([sku, product]) => (
                      <div
                        key={sku}
                        className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                      >
                        <span className="text-white/80 text-sm">{product.name}</span>
                        <span className="text-primary-400 font-medium">
                          {product.qty} uds
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Guides List */}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-white/60 text-xs mb-2 font-medium">Guías:</p>
                    <div className="space-y-1">
                      {storeData.guides.map((guide, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 group hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-white/70 text-xs font-mono">
                              {guide.guide_code}
                            </span>
                            {guide.status === 'confirmed' ? (
                              <CheckCircle2 className="w-3 h-3 text-green-400" />
                            ) : (
                              <Clock className="w-3 h-3 text-orange-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-xs">
                              {guide.dispatch_number}
                            </span>
                            <button
                              onClick={() => handleDeleteDispatch(guide.guide_code, guide.dispatch_number)}
                              className="p-1 rounded-md bg-red-500/0 hover:bg-red-500/20 border border-red-500/0 hover:border-red-500/30 text-red-400/0 group-hover:text-red-400 transition-all"
                              title="Eliminar (solo pruebas)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen de Productos Despachados */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Box className="w-6 h-6 text-purple-400" />
            Resumen de Productos Despachados
          </h2>

          {Object.keys(stats.byProduct).length === 0 ? (
            <p className="text-white/40 text-center py-8">
              No hay productos despachados hoy
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.byProduct)
                .sort((a, b) => b[1].qty - a[1].qty)  // Ordenar por cantidad DESC
                .map(([sku, product]) => (
                  <div
                    key={sku}
                    className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium">{product.name}</p>
                      <p className="text-white/40 text-sm">{sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-400">{product.qty}</p>
                      <p className="text-white/40 text-xs">unidades</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default DispatchDashboard;
