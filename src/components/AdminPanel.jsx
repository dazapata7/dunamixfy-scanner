import { useEffect, useState } from 'react';
import { ArrowLeft, TruckIcon, Trash2, BarChart3, Calendar, Package, Store, User, ShoppingCart } from 'lucide-react';
import { codesService, carriersService } from '../services/supabase';
import toast from 'react-hot-toast';

export function AdminPanel({ onBack, hideBackButton = false }) {
  const [activeTab, setActiveTab] = useState('stats'); // stats, history, carriers
  const [todayCodes, setTodayCodes] = useState([]);
  const [allCodes, setAllCodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, byCarrier: {} });
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(true);
      const [codes, statistics, carriersList] = await Promise.all([
        codesService.getToday(),
        codesService.getTodayStats(),
        carriersService.getAll()
      ]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {!hideBackButton ? (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver</span>
            </button>
          ) : (
            <div className="w-20"></div>
          )}

          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary-500" />
            <h1 className="text-2xl font-bold text-white">Estadísticas en Tiempo Real</h1>
          </div>

          <div className="w-20"></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-dark-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex gap-1 p-2">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
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

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">Cargando datos...</p>
          </div>
        ) : (
          <>
            {/* Tab: Estadísticas */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* Estadísticas del día */}
                <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold text-white mb-4">Estadísticas de Hoy</h2>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-dark-900 rounded-lg p-6 text-center border-2 border-primary-500">
                      <div className="text-4xl font-bold text-primary-500">{stats.total}</div>
                      <div className="text-sm text-gray-400 mt-2">Total Escaneados</div>
                    </div>

                    {Object.entries(stats.byCarrier).map(([carrier, count]) => (
                      <div key={carrier} className="bg-dark-900 rounded-lg p-6 text-center border border-gray-700">
                        <div className="text-4xl font-bold text-green-500">{count}</div>
                        <div className="text-sm text-gray-400 mt-2 capitalize">{carrier}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Códigos recientes */}
                <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold text-white mb-4">Últimos Escaneos de Hoy</h2>

                  <div className="space-y-3">
                    {todayCodes.slice(0, 10).map((code) => {
                      return (
                        <div
                          key={code.id}
                          className="bg-dark-900 rounded-lg p-4 border border-gray-700 group hover:border-primary-500 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Código y badges */}
                              <div className="flex items-center gap-3 mb-3">
                                <p className="font-mono font-bold text-white text-lg">{code.code}</p>
                                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                  {code.carrier_name || code.carriers?.display_name || 'Sin transportadora'}
                                </span>
                                {code.store_name && (
                                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                    {code.store_name}
                                  </span>
                                )}
                              </div>

                              {/* Información del cache */}
                              {code.customer_name && (
                                <div className="bg-dark-800 rounded-lg p-3 border border-gray-600 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold">
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

                              <p className="text-sm text-gray-400 mt-2">
                                {new Date(code.created_at).toLocaleString('es-CO')}
                              </p>
                            </div>

                            <button
                              onClick={() => handleDeleteCode(code.id, code.code)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg ml-2"
                            >
                              <Trash2 className="w-5 h-5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Historial Completo */}
            {activeTab === 'history' && (
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">Historial Completo</h2>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {(allCodes.length > 0 ? allCodes : todayCodes).map((code) => {
                    return (
                      <div
                        key={code.id}
                        className="bg-dark-900 rounded-lg p-4 border border-gray-700 group hover:border-primary-500 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            {/* Código y badges principales */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-mono font-bold text-white text-base">{code.code}</p>
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                <TruckIcon className="w-3 h-3 inline mr-1" />
                                {code.carrier_name || code.carriers?.display_name || 'Sin transportadora'}
                              </span>
                              {code.store_name && (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                                  <Store className="w-3 h-3 inline mr-1" />
                                  {code.store_name}
                                </span>
                              )}
                            </div>

                            {/* Detalles de la orden */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {/* Cliente */}
                              {code.customer_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="w-4 h-4 text-primary-400 flex-shrink-0" />
                                  <span className="text-white font-medium">{code.customer_name}</span>
                                </div>
                              )}

                              {/* Order ID */}
                              {code.order_id && (
                                <div className="flex items-center gap-2 text-sm">
                                  <ShoppingCart className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                  <span className="text-gray-300">Pedido #{code.order_id}</span>
                                </div>
                              )}

                              {/* Tipo de escaneo */}
                              {code.scan_type && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Package className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                  <span className="text-gray-300 capitalize">{code.scan_type}</span>
                                </div>
                              )}

                              {/* Fecha */}
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
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
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg flex-shrink-0"
                            title="Eliminar código"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
    </div>
  );
}
