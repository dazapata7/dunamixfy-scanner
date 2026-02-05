// =====================================================
// SCAN HISTORY - Dunamix WMS
// =====================================================
// Historial de escaneos de guías con trazabilidad completa
// Muestra: número de guía, fecha primer escaneo, operador, estado
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft,
  History,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  User,
  Truck,
  Loader2,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ScanHistory() {
  const navigate = useNavigate();
  const { selectedWarehouse } = useStore();

  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'confirmed', 'draft'
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'week', 'month', 'all'

  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
    } else {
      loadScanHistory();
    }
  }, [selectedWarehouse, navigate, dateFilter, statusFilter]);

  async function loadScanHistory() {
    setIsLoading(true);
    try {
      // Consultar dispatch_scan_history view (creada en migración 006)
      let query = supabase
        .from('dispatch_scan_history')
        .select('*')
        .eq('warehouse_id', selectedWarehouse.id);

      // Filtro por fecha
      if (dateFilter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('first_scanned_at', today.toISOString());
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('first_scanned_at', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('first_scanned_at', monthAgo.toISOString());
      }

      // Filtro por estado
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order('first_scanned_at', { ascending: false });

      if (error) throw error;

      setHistory(data || []);

    } catch (error) {
      console.error('❌ Error al cargar historial:', error);
      toast.error('Error al cargar historial de escaneos');
    } finally {
      setIsLoading(false);
    }
  }

  // Filtrar por término de búsqueda (guide_code o dispatch_number)
  const filteredHistory = history.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.guide_code?.toLowerCase().includes(search) ||
      item.dispatch_number?.toLowerCase().includes(search) ||
      item.carrier_name?.toLowerCase().includes(search)
    );
  });

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDuration(seconds) {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'confirmed':
        return {
          icon: CheckCircle2,
          text: 'Confirmado',
          color: 'bg-green-500/20 text-green-300 border-green-500/30'
        };
      case 'draft':
        return {
          icon: Clock,
          text: 'Pendiente',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
        };
      case 'shipped':
        return {
          icon: Truck,
          text: 'Enviado',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
        };
      default:
        return {
          icon: XCircle,
          text: 'Desconocido',
          color: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
        };
    }
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
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 rounded-2xl bg-purple-500/20">
              <History className="w-8 h-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Historial de Escaneos
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {selectedWarehouse?.name} - Trazabilidad completa de guías
              </p>
            </div>
            <button
              onClick={loadScanHistory}
              className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all"
            >
              Actualizar
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar guía o despacho..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
              <option value="all">Todo</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="all">Todos los estados</option>
              <option value="confirmed">Confirmados</option>
              <option value="draft">Pendientes</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
            <p className="text-white/60 text-sm mb-1">Total Escaneos</p>
            <p className="text-2xl font-bold text-white">{filteredHistory.length}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
            <p className="text-white/60 text-sm mb-1">Confirmados</p>
            <p className="text-2xl font-bold text-green-400">
              {filteredHistory.filter(h => h.status === 'confirmed').length}
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
            <p className="text-white/60 text-sm mb-1">Pendientes</p>
            <p className="text-2xl font-bold text-orange-400">
              {filteredHistory.filter(h => h.status === 'draft').length}
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
            <p className="text-white/60 text-sm mb-1">Tiempo Promedio</p>
            <p className="text-2xl font-bold text-blue-400">
              {formatDuration(
                filteredHistory
                  .filter(h => h.seconds_to_confirm)
                  .reduce((sum, h) => sum + h.seconds_to_confirm, 0) /
                filteredHistory.filter(h => h.seconds_to_confirm).length || 0
              )}
            </p>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No hay escaneos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                const statusBadge = getStatusBadge(item.status);
                const StatusIcon = statusBadge.icon;

                return (
                  <div
                    key={item.id}
                    className="bg-white/5 rounded-2xl border border-white/10 p-4 hover:bg-white/10 transition-all"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Guide Code */}
                      <div className="md:col-span-3">
                        <p className="text-white/40 text-xs mb-1">Número de Guía</p>
                        <p className="text-white font-mono text-sm">{item.guide_code}</p>
                        <p className="text-white/40 text-xs mt-1">{item.dispatch_number}</p>
                      </div>

                      {/* Carrier */}
                      <div className="md:col-span-2">
                        <p className="text-white/40 text-xs mb-1">Transportadora</p>
                        <p className="text-white text-sm">{item.carrier_name}</p>
                      </div>

                      {/* First Scan */}
                      <div className="md:col-span-3">
                        <p className="text-white/40 text-xs mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Primer Escaneo
                        </p>
                        <p className="text-white text-sm">{formatDate(item.first_scanned_at)}</p>
                        {item.first_scanned_by_name && (
                          <p className="text-white/60 text-xs mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.first_scanned_by_name}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2">
                        <span className={`
                          px-3 py-1 rounded-lg text-xs font-medium border
                          ${statusBadge.color}
                          flex items-center gap-1 w-fit
                        `}>
                          <StatusIcon className="w-3 h-3" />
                          {statusBadge.text}
                        </span>
                        {item.seconds_to_confirm && (
                          <p className="text-white/40 text-xs mt-2">
                            ⏱️ {formatDuration(item.seconds_to_confirm)}
                          </p>
                        )}
                      </div>

                      {/* Confirmed */}
                      {item.confirmed_at && (
                        <div className="md:col-span-2">
                          <p className="text-white/40 text-xs mb-1">Confirmado</p>
                          <p className="text-green-400 text-xs">{formatDate(item.confirmed_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default ScanHistory;
