// =====================================================
// INVENTORY HISTORY - Historial de Movimientos de Inventario
// =====================================================
// Muestra todos los movimientos de inventario (IN/OUT)
// Filtrable por producto, rango de fechas, tipo de movimiento
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Calendar,
  Package,
  Loader2,
  Search,
  Filter,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function InventoryHistory() {
  const navigate = useNavigate();

  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'in', 'out'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadMovements();
  }, []);

  async function loadMovements() {
    setIsLoading(true);
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          *,
          product:products(id, name, sku),
          carrier:carriers(id, display_name, code)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      const { data, error } = await query;

      if (error) throw error;

      // Obtener detalles de despachos para movimientos con ref_type='dispatch'
      const dispatchIds = [...new Set(data?.filter(m => m.ref_type === 'dispatch').map(m => m.ref_id) || [])];
      let dispatchMap = {};

      if (dispatchIds.length > 0) {
        const { data: dispatchData } = await supabase
          .from('dispatches')
          .select('id, dispatch_number, guide_code')
          .in('id', dispatchIds);

        dispatchMap = Object.fromEntries(dispatchData?.map(d => [d.id, d]) || []);
      }

      // Enriquecer movimientos con datos de despachos
      const enrichedData = data?.map(m => ({
        ...m,
        dispatch: m.ref_type === 'dispatch' ? dispatchMap[m.ref_id] : null,
        guide_code: m.ref_type === 'dispatch' && dispatchMap[m.ref_id] ? dispatchMap[m.ref_id].guide_code : null
      })) || [];

      setMovements(enrichedData);
      console.log(`✅ ${enrichedData?.length || 0} movimientos cargados`);

    } catch (error) {
      console.error('❌ Error al cargar movimientos:', error);
      toast.error('Error al cargar historial de movimientos');
    } finally {
      setIsLoading(false);
    }
  }

  // Filtrar movimientos según criterios
  const filteredMovements = movements.filter(movement => {
    const matchesSearch =
      movement.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.dispatch?.dispatch_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.guide_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.carrier?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.external_order_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      typeFilter === 'all' ||
      movement.movement_type === (typeFilter === 'in' ? 'IN' : 'OUT');

    const movementDate = new Date(movement.created_at);

    // Fechas con hora para comparación correcta
    const fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
    const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date('2099-12-31');

    const matchesDate = movementDate >= fromDate && movementDate <= toDate;

    return matchesSearch && matchesType && matchesDate;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Cargando movimientos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-7xl mx-auto">

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
            📊 Historial de Movimientos de Inventario
          </h1>

          <div className="w-[120px]"></div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-glass-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar producto, guía, orden o transportadora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary-400 focus:bg-white/10 transition-all"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-400 focus:bg-white/10 transition-all"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Todos los tipos</option>
              <option value="in" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Entradas (IN)</option>
              <option value="out" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Salidas (OUT)</option>
            </select>

            {/* Date From */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-400 focus:bg-white/10 transition-all"
            />

            {/* Date To */}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-400 focus:bg-white/10 transition-all"
            />
          </div>

          {/* Results count + Clear filters */}
          <div className="flex items-center justify-between">
            <div className="text-white/60 text-sm">
              Mostrando {filteredMovements.length} de {movements.length} movimientos
            </div>

            {(searchTerm || typeFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all text-sm"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Movements Table */}
        <div className="space-y-3">
          {filteredMovements.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
              <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No hay movimientos que coincidan con los filtros</p>
            </div>
          ) : (
            filteredMovements.map((movement) => (
              <div
                key={movement.id}
                className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-3 hover:bg-white/10 transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center text-sm">
                  {/* Tipo de movimiento */}
                  <div className="flex items-center gap-2">
                    {movement.movement_type === 'OUT' ? (
                      <div className="p-1.5 rounded-lg bg-red-500/20">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-green-500/20">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium text-xs">
                        {movement.movement_type === 'OUT' ? 'SALIDA' : 'ENTRADA'}
                      </p>
                    </div>
                  </div>

                  {/* Producto */}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">📦 Producto</p>
                    <p className="text-white font-medium text-xs truncate">{movement.product?.name || 'N/A'}</p>
                  </div>

                  {/* Cantidad */}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">📊 Cant</p>
                    <p className={`font-bold ${
                      movement.movement_type === 'OUT' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {movement.movement_type === 'OUT' ? '-' : '+'}{Math.abs(movement.qty_signed)}
                    </p>
                  </div>

                  {/* Transportadora */}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">🚚 Transportadora</p>
                    <p className="text-white font-medium text-xs truncate">
                      {movement.carrier?.display_name || 'N/A'}
                    </p>
                  </div>

                  {/* Guía */}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">📋 Guía</p>
                    <p className="text-white font-medium text-xs font-mono truncate">
                      {movement.guide_code || movement.dispatch?.guide_code || 'N/A'}
                    </p>
                  </div>

                  {/* Orden Externa */}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">🔢 Orden</p>
                    <p className="text-white font-medium text-xs font-mono truncate">
                      {movement.external_order_id || 'N/A'}
                    </p>
                  </div>

                  {/* Fecha */}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">📅 Fecha</p>
                    <p className="text-white font-medium text-xs">
                      {format(new Date(movement.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

export default InventoryHistory;
