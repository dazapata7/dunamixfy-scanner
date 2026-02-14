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
  CheckCircle
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
          operator:operators!dispatches_operator_id_fkey(name)
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

      // Intentar por dispatch_number primero (más directo)
      const { data, error } = await supabase.rpc('delete_dispatch_for_testing', {
        p_dispatch_number: dispatchNumber
      });

      if (error) throw error;

      if (data && data.length > 0 && data[0].success) {
        console.log(`✅ Dispatch ${dispatchNumber} eliminado. RPC response:`, data[0]);

        // Eliminar del estado local inmediatamente
        setDispatches(prev => prev.filter(d => d.id !== dispatchId));

        // 🔗 Marcar como unscanned en Dunamixfy
        const dunamixfyResponse = await dunamixfyService.markOrderAsUnscanned(trackingCode);
        if (dunamixfyResponse.success) {
          console.log(`✅ Guía ${trackingCode} marcada como unscanned en Dunamixfy`);
        } else {
          console.warn(`⚠️ No se pudo marcar como unscanned en Dunamixfy:`, dunamixfyResponse.message);
        }

        toast.success('Dispatch eliminado exitosamente', { id: 'delete' });

        // Recargar desde BD para confirmar que realmente se eliminó
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
              const isDraft = dispatch.status !== 'confirmed';

              return (
                <div
                  key={dispatch.id}
                  className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-3 shadow-glass-lg hover:bg-white/10 transition-all"
                >
                  {/* Compact Header: Guía + Status + Actions */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Guía */}
                      <span className="text-white font-bold text-sm font-mono truncate">
                        📦 {dispatch.guide_code}
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                        isDraft
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}>
                        {isDraft ? 'CONFIRMADO' : 'BORRADOR'}
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
                    {/* Transportadora */}
                    <div>
                      <p className="text-white/40 mb-0.5">🚚 Transportadora</p>
                      <p className="text-white font-medium truncate" title={carrierName}>{carrierName}</p>
                    </div>

                    {/* Tienda */}
                    <div>
                      <p className="text-white/40 mb-0.5">🏪 Tienda</p>
                      <p className="text-white font-medium truncate" title={storeName}>{storeName}</p>
                    </div>

                    {/* Cliente */}
                    <div>
                      <p className="text-white/40 mb-0.5">👤 Cliente</p>
                      <p className="text-white font-medium truncate" title={customerName}>{customerName}</p>
                    </div>

                    {/* Fecha Despacho */}
                    <div>
                      <p className="text-white/40 mb-0.5">📅 Fecha</p>
                      <p className="text-white font-medium">
                        {format(new Date(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Productos - Compact */}
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
