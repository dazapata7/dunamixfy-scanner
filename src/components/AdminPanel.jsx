import { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, TruckIcon, Trash2, BarChart3, Calendar, Package, Store, User, ShoppingCart, RefreshCw, Download, X, Plus, Search } from 'lucide-react';
import { codesService, carriersService } from '../services/supabase';
import { backfillService } from '../services/backfillService';
import { useAuth } from '../hooks/useAuth'; // V5: Para mostrar usuario conectado
import toast from 'react-hot-toast';

export function AdminPanel({ onBack, hideBackButton = false, hideUserBadge = false }) {
  const { user } = useAuth(); // V5: Obtener usuario actual
  const [activeTab, setActiveTab] = useState('stats'); // stats, history, carriers
  const [todayCodes, setTodayCodes] = useState([]);
  const [allCodes, setAllCodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, byCarrier: {}, byStore: {} });
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // V6: Iniciar en false para evitar flash de loading

  // Backfill state
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(null);
  const [showBackfillModal, setShowBackfillModal] = useState(false);

  // Filtros de fecha para historial
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filteredStats, setFilteredStats] = useState({ total: 0, byCarrier: {}, byStore: {} });

  // V6: Búsqueda y filtros avanzados
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarriers, setSelectedCarriers] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);

  // Cargar datos iniciales
  useEffect(() => {
    loadAllData();

    // Suscribirse a cambios en tiempo real
    const unsubscribe = codesService.subscribeToChanges(() => {
      loadAllData();
    });

    return () => unsubscribe();
  }, []);

  const loadAllData = async () => {
    try {
      // V6: Solo mostrar loading si toma más de 300ms (evita flash)
      const loadingTimeout = setTimeout(() => setIsLoading(true), 300);

      const [codes, statistics, carriersList] = await Promise.all([
        codesService.getToday(),
        codesService.getTodayStats(),
        carriersService.getAll()
      ]);

      clearTimeout(loadingTimeout);
      setTodayCodes(codes);
      setStats(statistics);
      setCarriers(carriersList);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando datos');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllHistory = async () => {
    try {
      const codes = await codesService.getAll();
      setAllCodes(codes);
    } catch (error) {
      console.error('Error cargando historial:', error);
      toast.error('Error cargando historial');
    }
  };

  // Función para obtener rango de fechas según filtro
  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) return null;
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    };
  };

  // Aplicar filtro de fecha
  const applyDateFilter = async () => {
    const dateRange = getDateRange();
    if (!dateRange) {
      toast.error('Selecciona un rango de fechas válido');
      return;
    }

    try {
      setIsLoading(true);
      const [codes, statistics] = await Promise.all([
        codesService.getByDateRange(dateRange.start, dateRange.end),
        codesService.getStatsByDateRange(dateRange.start, dateRange.end)
      ]);

      setAllCodes(codes);
      setFilteredStats(statistics);
    } catch (error) {
      console.error('Error aplicando filtro:', error);
      toast.error('Error aplicando filtro de fecha');
    } finally {
      setIsLoading(false);
    }
  };

  // Exportar códigos a CSV
  const exportToCSV = () => {
    try {
      // V6: Usar filteredCodes para respetar búsqueda y filtros aplicados
      const codesToExport = filteredCodes.length > 0 ? filteredCodes : (allCodes.length > 0 ? allCodes : todayCodes);

      if (codesToExport.length === 0) {
        toast.error('No hay códigos para exportar');
        return;
      }

      // Crear CSV con headers
      const headers = ['Código', 'Transportadora', 'Tienda', 'Cliente', 'Pedido', 'Tipo', 'Fecha'];
      const rows = codesToExport.map(code => [
        code.code,
        code.carrier_name || code.carriers?.display_name || 'N/A',
        code.store_name || 'N/A',
        code.customer_name || 'N/A',
        code.order_id || 'N/A',
        code.scan_type || 'N/A',
        new Date(code.created_at).toLocaleString('es-CO')
      ]);

      // Combinar headers y rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Crear Blob y descargar
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const filterLabel = dateFilter === 'today' ? 'hoy' :
                         dateFilter === 'yesterday' ? 'ayer' :
                         dateFilter === 'week' ? 'semana' :
                         dateFilter === 'month' ? 'mes' :
                         'custom';

      link.setAttribute('href', url);
      link.setAttribute('download', `dunamix-codigos-${filterLabel}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`✅ Exportados ${codesToExport.length} códigos a CSV`);
    } catch (error) {
      console.error('Error exportando CSV:', error);
      toast.error('Error al exportar CSV');
    }
  };

  // Efecto para aplicar filtro cuando cambia
  useEffect(() => {
    if (activeTab === 'history') {
      applyDateFilter();
    }
  }, [dateFilter, activeTab]);

  // V6: Filtrado avanzado con búsqueda y filtros combinados
  const filteredCodes = useMemo(() => {
    const codesToFilter = allCodes.length > 0 ? allCodes : todayCodes;

    return codesToFilter.filter(code => {
      // Filtro de búsqueda (código, cliente, pedido, tienda)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          code.code?.toLowerCase().includes(query) ||
          code.customer_name?.toLowerCase().includes(query) ||
          code.order_id?.toLowerCase().includes(query) ||
          code.store_name?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Filtro por transportadora
      if (selectedCarriers.length > 0) {
        const carrierName = code.carrier_name || code.carriers?.display_name;
        if (!selectedCarriers.includes(carrierName)) return false;
      }

      // Filtro por tienda
      if (selectedStores.length > 0) {
        if (!selectedStores.includes(code.store_name)) return false;
      }

      return true;
    });
  }, [allCodes, todayCodes, searchQuery, selectedCarriers, selectedStores]);

  // V6: Obtener listas únicas de transportadoras y tiendas para filtros
  const availableCarriers = useMemo(() => {
    const codesToAnalyze = allCodes.length > 0 ? allCodes : todayCodes;
    const carriers = new Set();
    codesToAnalyze.forEach(code => {
      const carrierName = code.carrier_name || code.carriers?.display_name;
      if (carrierName) carriers.add(carrierName);
    });
    return Array.from(carriers).sort();
  }, [allCodes, todayCodes]);

  const availableStores = useMemo(() => {
    const codesToAnalyze = allCodes.length > 0 ? allCodes : todayCodes;
    const stores = new Set();
    codesToAnalyze.forEach(code => {
      if (code.store_name) stores.add(code.store_name);
    });
    return Array.from(stores).sort();
  }, [allCodes, todayCodes]);

  // V6: Función para resaltar matches en el texto
  const highlightMatch = (text, query) => {
    if (!query || !text) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-400/30 text-yellow-200 px-1 rounded">{part}</mark>
        : part
    );
  };

  // V6: Toggle filtro de transportadora
  const toggleCarrierFilter = (carrier) => {
    setSelectedCarriers(prev =>
      prev.includes(carrier)
        ? prev.filter(c => c !== carrier)
        : [...prev, carrier]
    );
  };

  // V6: Toggle filtro de tienda
  const toggleStoreFilter = (store) => {
    setSelectedStores(prev =>
      prev.includes(store)
        ? prev.filter(s => s !== store)
        : [...prev, store]
    );
  };

  // V6: Limpiar todos los filtros
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCarriers([]);
    setSelectedStores([]);
  };

  const handleDeleteCode = async (id, code) => {
    if (!confirm(`¿Eliminar código ${code}?`)) return;

    try {
      console.log('🗑️ Intentando eliminar código:', { id, code });
      const result = await codesService.delete(id);
      console.log('✅ Código eliminado exitosamente:', result);
      toast.success('Código eliminado');
      await loadAllData();
    } catch (error) {
      console.error('❌ Error eliminando código:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const handleStartBackfill = async () => {
    try {
      // Contar códigos que necesitan backfill
      const codes = await backfillService.getCodesNeedingBackfill();

      if (codes.length === 0) {
        toast('No hay códigos que necesiten actualización', { icon: 'ℹ️' });
        return;
      }

      setShowBackfillModal(true);
    } catch (error) {
      console.error('Error verificando backfill:', error);
      toast.error('Error al verificar códigos');
    }
  };

  const handleRunBackfill = async () => {
    setIsBackfilling(true);
    setBackfillProgress({ current: 0, total: 0, percentage: 0 });

    try {
      const result = await backfillService.runBackfill((progress) => {
        setBackfillProgress(progress);
      });

      setIsBackfilling(false);

      if (result.success > 0) {
        toast.success(`✅ Backfill completado: ${result.success} códigos actualizados`);
        await loadAllData();
        if (activeTab === 'history' && allCodes.length > 0) {
          await loadAllHistory();
        }
      }

      if (result.failed > 0) {
        toast.error(`⚠️ ${result.failed} códigos no pudieron actualizarse`);
      }

      // Mostrar resumen
      console.log('📊 Resumen del backfill:', result);

    } catch (error) {
      console.error('Error ejecutando backfill:', error);
      toast.error('Error al ejecutar backfill');
      setIsBackfilling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* V6: Header más compacto */}
      <div className="bg-dark-800 border-b border-gray-700 p-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {!hideBackButton ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          ) : (
            <div className="w-16"></div>
          )}

          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <h1 className="text-lg font-bold text-white">Estadísticas en Tiempo Real</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* V6: Indicador de usuario más compacto - Oculto en desktop (ya está arriba) */}
            {user && !hideUserBadge && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-700 rounded-lg border border-gray-600">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500/20 to-cyan-500/20 flex items-center justify-center border border-primary-400/30">
                  <User className="w-3.5 h-3.5 text-primary-400" />
                </div>
                <p className="text-xs font-semibold text-white">{user.email}</p>
              </div>
            )}

            <button
              onClick={handleStartBackfill}
              disabled={isBackfilling}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBackfilling ? 'animate-spin' : ''}`} />
              <span>{isBackfilling ? 'Actualizando...' : 'Actualizar desde Dunamixfy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* V6: Tabs más compactos */}
      <div className="bg-dark-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex gap-1 p-1.5">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
              activeTab === 'stats'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Estadísticas
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              if (allCodes.length === 0) loadAllHistory();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
              activeTab === 'history'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Historial
          </button>

          <button
            onClick={() => setActiveTab('carriers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${
              activeTab === 'carriers'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <TruckIcon className="w-4 h-4" />
            Transportadoras ({carriers.length})
          </button>
        </div>
      </div>

      {/* V6: Content más compacto */}
      <div className="max-w-7xl mx-auto p-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-3 text-sm">Cargando datos...</p>
          </div>
        ) : (
          <>
            {/* Tab: Estadísticas */}
            {activeTab === 'stats' && (
              <div className="space-y-3">
                {/* V6: Estadísticas del día - más compacto */}
                <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
                  <h2 className="text-base font-bold text-white mb-3">Estadísticas de Hoy</h2>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-dark-900 rounded-lg p-4 text-center border-2 border-primary-500">
                      <div className="text-2xl font-bold text-primary-500">{stats.total}</div>
                      <div className="text-xs text-gray-400 mt-1">Total Escaneados</div>
                    </div>

                    {Object.entries(stats.byCarrier).map(([carrier, count]) => (
                      <div key={carrier} className="bg-dark-900 rounded-lg p-4 text-center border border-gray-700">
                        <div className="text-2xl font-bold text-green-500">{count}</div>
                        <div className="text-xs text-gray-400 mt-1 capitalize">{carrier}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* V6: Estadísticas por Tienda - más compacto */}
                {stats.byStore && Object.keys(stats.byStore).length > 0 && (
                  <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
                    <h2 className="text-base font-bold text-white mb-3">
                      📊 Guías por Tienda (Hoy)
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {Object.entries(stats.byStore)
                        .sort(([, a], [, b]) => b - a)
                        .map(([store, count]) => (
                          <div key={store} className="bg-dark-900 rounded-lg p-3 text-center border border-gray-700">
                            <div className="text-2xl font-bold text-blue-500">{count}</div>
                            <div className="text-xs text-gray-400 mt-1">{store}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* V6: Códigos recientes - más compacto */}
                <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
                  <h2 className="text-base font-bold text-white mb-3">Últimos Escaneos de Hoy</h2>

                  <div className="space-y-2">
                    {todayCodes.slice(0, 10).map((code) => {
                      return (
                        <div
                          key={code.id}
                          className="bg-dark-900 rounded-lg p-3 border border-gray-700 group hover:border-primary-500 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Código y badges */}
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-mono font-bold text-white text-sm">{code.code}</p>
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                  {code.carrier_name || code.carriers?.display_name || 'Sin transportadora'}
                                </span>
                                {code.store_name && (
                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                    {code.store_name}
                                  </span>
                                )}
                              </div>

                              {/* Información del cache */}
                              {code.customer_name && (
                                <div className="bg-dark-800 rounded-lg p-2 border border-gray-600">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white text-xs font-semibold">
                                      👤 {code.customer_name}
                                    </span>
                                    {code.order_id && (
                                      <span className="text-xs text-gray-400">
                                        (Pedido #{code.order_id})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <p className="text-xs text-gray-400 mt-1.5">
                                {new Date(code.created_at).toLocaleString('es-CO')}
                              </p>
                            </div>

                            <button
                              onClick={() => handleDeleteCode(code.id, code.code)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-lg ml-2"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* V6: Tab: Historial Completo - más compacto */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {/* V6: Filtros de Fecha - más compacto */}
                <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
                  <h2 className="text-base font-bold text-white mb-3">Filtros de Fecha</h2>

                  <div className="space-y-3">
                    {/* Atajos de fecha */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setDateFilter('today')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                          dateFilter === 'today'
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        }`}
                      >
                        Hoy
                      </button>
                      <button
                        onClick={() => setDateFilter('yesterday')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                          dateFilter === 'yesterday'
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        }`}
                      >
                        Ayer
                      </button>
                      <button
                        onClick={() => setDateFilter('week')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                          dateFilter === 'week'
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        }`}
                      >
                        7 días
                      </button>
                      <button
                        onClick={() => setDateFilter('month')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                          dateFilter === 'month'
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        }`}
                      >
                        Mes
                      </button>
                      <button
                        onClick={() => setDateFilter('custom')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                          dateFilter === 'custom'
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        }`}
                      >
                        Personalizado
                      </button>
                    </div>

                    {/* Selector de rango personalizado */}
                    {dateFilter === 'custom' && (
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="block text-sm text-gray-400 mb-2">Desde</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full bg-dark-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm text-gray-400 mb-2">Hasta</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full bg-dark-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={applyDateFilter}
                          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* V6: Búsqueda y Filtros Avanzados */}
                <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-white">Búsqueda y Filtros</h3>
                    {(searchQuery || selectedCarriers.length > 0 || selectedStores.length > 0) && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  {/* Barra de búsqueda */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por código, cliente, pedido o tienda..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-dark-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none text-sm placeholder-gray-500"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filtros de transportadora y tienda */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Transportadoras */}
                    {availableCarriers.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Transportadora</label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableCarriers.map(carrier => (
                            <button
                              key={carrier}
                              onClick={() => toggleCarrierFilter(carrier)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                selectedCarriers.includes(carrier)
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                              }`}
                            >
                              {carrier}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tiendas */}
                    {availableStores.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">Tienda</label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableStores.map(store => (
                            <button
                              key={store}
                              onClick={() => toggleStoreFilter(store)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                selectedStores.includes(store)
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                              }`}
                            >
                              {store}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contador de resultados */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400">
                      Mostrando <span className="text-primary-400 font-semibold">{filteredCodes.length}</span> de{' '}
                      <span className="text-white font-semibold">
                        {allCodes.length > 0 ? allCodes.length : todayCodes.length}
                      </span>{' '}
                      códigos
                    </p>
                  </div>
                </div>

                {/* Estadísticas por Tienda */}
                {filteredStats.byStore && Object.keys(filteredStats.byStore).length > 0 && (
                  <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-bold text-white mb-4">
                      📊 Guías por Tienda ({filteredStats.total} total)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(filteredStats.byStore)
                        .sort(([, a], [, b]) => b - a)
                        .map(([store, count]) => (
                          <div key={store} className="bg-dark-900 rounded-lg p-4 border border-gray-700">
                            <p className="text-gray-400 text-sm mb-1">{store}</p>
                            <p className="text-3xl font-bold text-primary-500">{count}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Listado de códigos */}
                <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-white">
                      Códigos Escaneados ({filteredCodes.length})
                    </h2>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs font-medium"
                      title="Exportar a CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar CSV
                    </button>
                  </div>

                  {/* V6: Mensaje si no hay resultados */}
                  {filteredCodes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm">No se encontraron códigos con los filtros aplicados</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {filteredCodes.map((code) => {
                        return (
                          <div
                            key={code.id}
                            className="bg-dark-900 rounded-lg p-3 border border-gray-700 group hover:border-primary-500 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                {/* Código y badges principales */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-mono font-bold text-white text-sm">
                                    {highlightMatch(code.code, searchQuery)}
                                  </p>
                                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                    <TruckIcon className="w-3 h-3 inline mr-0.5" />
                                    {code.carrier_name || code.carriers?.display_name || 'Sin transportadora'}
                                  </span>
                                  {code.store_name && (
                                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                      <Store className="w-3 h-3 inline mr-0.5" />
                                      {highlightMatch(code.store_name, searchQuery)}
                                    </span>
                                  )}
                                </div>

                                {/* Detalles de la orden */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                  {/* Cliente */}
                                  {code.customer_name && (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <User className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                                      <span className="text-white font-medium">
                                        {highlightMatch(code.customer_name, searchQuery)}
                                      </span>
                    </div>
                  )}

                              {/* Order ID */}
                              {code.order_id && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <ShoppingCart className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                                  <span className="text-gray-300">
                                    Pedido #{highlightMatch(code.order_id, searchQuery)}
                                  </span>
                                </div>
                              )}

                              {/* Tipo de escaneo */}
                              {code.scan_type && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Package className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                  <span className="text-gray-300 capitalize">{code.scan_type}</span>
                                </div>
                              )}

                              {/* Fecha */}
                              <div className="flex items-center gap-1.5 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-400">
                                  {new Date(code.created_at).toLocaleString('es-CO', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteCode(code.id, code.code)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-lg flex-shrink-0"
                            title="Eliminar código"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
              </div>
            )}

            {/* Tab: Transportadoras */}
            {activeTab === 'carriers' && (
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Transportadoras Activas</h2>
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                    Agregar Transportadora
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {carriers.map((carrier) => (
                    <div
                      key={carrier.id}
                      className="bg-dark-900 rounded-lg p-6 border border-gray-700"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white">{carrier.display_name}</h3>
                          <p className="text-sm text-gray-400 mt-1">Código: {carrier.code}</p>
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-gray-500">
                              Reglas de validación: {JSON.stringify(carrier.validation_rules).length} caracteres
                            </p>
                            {carrier.extraction_config && (
                              <p className="text-xs text-gray-500">
                                Config extracción: Sí
                              </p>
                            )}
                          </div>
                        </div>
                        <TruckIcon className="w-10 h-10 text-primary-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>

      {/* Modal: Backfill Confirmation */}
      {showBackfillModal && (
        <BackfillModal
          isRunning={isBackfilling}
          progress={backfillProgress}
          onConfirm={handleRunBackfill}
          onClose={() => {
            if (!isBackfilling) {
              setShowBackfillModal(false);
              setBackfillProgress(null);
            }
          }}
        />
      )}
    </div>
  );
}

// ========== MODAL: BACKFILL ==========
function BackfillModal({ isRunning, progress, onConfirm, onClose }) {
  const [codesCount, setCodesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCodesCount();
  }, []);

  const loadCodesCount = async () => {
    try {
      const codes = await backfillService.getCodesNeedingBackfill();
      setCodesCount(codes.length);
    } catch (error) {
      console.error('Error cargando códigos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <RefreshCw className={`w-6 h-6 text-blue-500 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {isRunning ? 'Actualizando Códigos' : 'Actualizar desde Dunamixfy'}
            </h2>
          </div>

          {!isRunning && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-400 text-sm">Verificando códigos...</p>
          </div>
        ) : (
          <>
            {!isRunning && (
              <div className="space-y-4">
                <div className="bg-dark-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-white mb-2">
                    Se encontraron <span className="font-bold text-primary-500">{codesCount}</span> códigos
                    que necesitan actualizar su información desde Dunamixfy.
                  </p>
                  <p className="text-sm text-gray-400">
                    Este proceso consultará la API de Dunamixfy para cada código y actualizará:
                  </p>
                  <ul className="text-sm text-gray-400 mt-2 space-y-1 ml-4">
                    <li>• Nombre del cliente</li>
                    <li>• ID de la orden</li>
                    <li>• Nombre de la tienda</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                  >
                    Iniciar Actualización
                  </button>
                </div>
              </div>
            )}

            {isRunning && progress && (
              <div className="space-y-4">
                <div className="bg-dark-900 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Progreso</span>
                    <span className="text-primary-500 font-bold">{progress.percentage}%</span>
                  </div>

                  <div className="w-full bg-dark-700 rounded-full h-3 mb-3 overflow-hidden">
                    <div
                      className="bg-primary-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progress.percentage}%` }}
                    ></div>
                  </div>

                  <p className="text-sm text-gray-400 text-center">
                    Procesando {progress.current} de {progress.total} códigos
                  </p>

                  {progress.code && (
                    <p className="text-xs text-gray-500 text-center mt-2 font-mono">
                      {progress.code}
                    </p>
                  )}
                </div>

                <p className="text-sm text-gray-400 text-center">
                  Por favor, no cierres esta ventana...
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
