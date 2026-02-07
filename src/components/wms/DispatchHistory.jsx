// =====================================================
// DISPATCH HISTORY - Dunamix WMS
// =====================================================
// Historial completo de pedidos/despachos
// Muestra: Guía, Transportadora, Fecha Pedido, Fecha Despacho, Productos, Tienda, Cliente
// Incluye botón para eliminar (solo pruebas)
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dispatchesService } from '../../services/wmsService';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft,
  Package,
  Calendar,
  Trash2,
  Loader2,
  Search,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function DispatchHistory({ warehouseId = null }) {
  const navigate = useNavigate();

  const [dispatches, setDispatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadHistory();
  }, [warehouseId]);

  async function loadHistory() {
    setIsLoading(true);
    try {
      // Obtener TODOS los dispatches (no solo del día)
      const query = supabase
        .from('dispatches')
        .select(`
          *,
          dispatch_items(*, products(*)),
          shipment_record:shipment_records(*, carriers(*)),
          warehouse:warehouses(name),
          operator:operators(name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

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

  async function handleDeleteDispatch(trackingCode, dispatchNumber) {
    if (!confirm(`¿Eliminar guía ${trackingCode}?\n\nEsto es solo para pruebas. Se eliminarán todos los registros relacionados.`)) {
      return;
    }

    try {
      toast.loading('Eliminando dispatch...', { id: 'delete' });

      const { data, error } = await supabase.rpc('delete_dispatch_for_testing', {
        p_tracking_code: trackingCode
      });

      if (error) throw error;

      if (data && data.length > 0 && data[0].success) {
        toast.success('Dispatch eliminado exitosamente', { id: 'delete' });
        await loadHistory();
      } else {
        toast.error('No se encontró el dispatch', { id: 'delete' });
      }
    } catch (error) {
      console.error('❌ Error al eliminar dispatch:', error);
      toast.error(error.message || 'Error al eliminar dispatch', { id: 'delete' });
    }
  }

  // Filtrar dispatches por búsqueda
  const filteredDispatches = dispatches.filter(dispatch => {
    const searchLower = searchTerm.toLowerCase();
    return (
      dispatch.guide_code?.toLowerCase().includes(searchLower) ||
      dispatch.dispatch_number?.toLowerCase().includes(searchLower) ||
      dispatch.shipment_record?.raw_payload?.customer_name?.toLowerCase().includes(searchLower) ||
      dispatch.shipment_record?.raw_payload?.store?.toLowerCase().includes(searchLower) ||
      dispatch.shipment_record?.carriers?.display_name?.toLowerCase().includes(searchLower)
    );
  });

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
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/wms')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <h1 className="text-2xl font-bold text-white flex-1 text-center">
            📋 Historial de Pedidos
          </h1>

          <div className="w-[100px]"></div> {/* Spacer para centrar título */}
        </div>

        {/* Search Bar */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-glass-lg mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por guía, cliente, tienda, transportadora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>
          <p className="text-white/40 text-sm mt-2">
            {filteredDispatches.length} de {dispatches.length} pedidos
          </p>
        </div>

        {/* Dispatches List */}
        <div className="space-y-4">
          {filteredDispatches.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
              <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/60">
                {searchTerm ? 'No se encontraron resultados' : 'No hay pedidos en el historial'}
              </p>
            </div>
          ) : (
            filteredDispatches.map((dispatch) => {
              const customerName = dispatch.shipment_record?.raw_payload?.customer_name || 'N/A';
              const storeName = dispatch.shipment_record?.raw_payload?.store ||
                                dispatch.shipment_record?.raw_payload?.dropshipper ||
                                'Sin tienda';
              const carrierName = dispatch.shipment_record?.carriers?.display_name || 'Sin transportadora';
              const orderDate = dispatch.shipment_record?.raw_payload?.order_date || dispatch.created_at;

              return (
                <div
                  key={dispatch.id}
                  className="group bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-glass-lg hover:bg-white/10 transition-all"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Guía */}
                        <span className="text-white font-bold text-lg font-mono">
                          📦 {dispatch.guide_code}
                        </span>

                        {/* Status Badge */}
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          dispatch.status === 'confirmed'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        }`}>
                          {dispatch.status === 'confirmed' ? 'CONFIRMADO' : 'BORRADOR'}
                        </span>
                      </div>

                      <p className="text-white/40 text-sm">
                        Dispatch: {dispatch.dispatch_number}
                      </p>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteDispatch(dispatch.guide_code, dispatch.dispatch_number)}
                      className="p-2 rounded-lg bg-red-500/0 hover:bg-red-500/20 border border-red-500/0 hover:border-red-500/30 text-red-400/0 group-hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                      title="Eliminar (solo pruebas)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Grid de Información */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Transportadora */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-white/40 text-xs mb-1">🚚 Transportadora</p>
                      <p className="text-white font-medium">{carrierName}</p>
                    </div>

                    {/* Tienda */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-white/40 text-xs mb-1">🏪 Tienda</p>
                      <p className="text-white font-medium truncate" title={storeName}>
                        {storeName}
                      </p>
                    </div>

                    {/* Cliente */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-white/40 text-xs mb-1">👤 Cliente</p>
                      <p className="text-white font-medium truncate" title={customerName}>
                        {customerName}
                      </p>
                    </div>
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Fecha del Pedido */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="text-white/40 text-xs">Fecha del Pedido</p>
                        <p className="text-white text-sm">
                          {format(new Date(orderDate), 'dd MMM yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>

                    {/* Fecha de Despacho (Escaneo) */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-white/40 text-xs">Fecha de Despacho (Escaneo)</p>
                        <p className="text-white text-sm">
                          {format(new Date(dispatch.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Productos */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-white/40 text-xs mb-2">📦 Productos ({dispatch.dispatch_items?.length || 0})</p>
                    <div className="space-y-1">
                      {dispatch.dispatch_items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-white/80">
                            {item.products?.name || 'Producto'}
                          </span>
                          <span className="text-white/60">
                            Qty: {item.qty}
                          </span>
                        </div>
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
