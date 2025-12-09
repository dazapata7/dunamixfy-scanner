import { useEffect, useState } from 'react';
import { ArrowLeft, TruckIcon, Store, Trash2, BarChart3, Calendar } from 'lucide-react';
import { codesService, carriersService, storesService } from '../services/supabase';
import toast from 'react-hot-toast';

export function AdminPanel({ onBack, hideBackButton = false }) {
  const [activeTab, setActiveTab] = useState('stats'); // stats, history, carriers, stores
  const [todayCodes, setTodayCodes] = useState([]);
  const [allCodes, setAllCodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, byCarrier: {}, byStore: {} });
  const [carriers, setCarriers] = useState([]);
  const [stores, setStores] = useState([]);
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
      const [codes, statistics, carriersList, storesList] = await Promise.all([
        codesService.getToday(),
        codesService.getTodayStats(),
        carriersService.getAll(),
        storesService.getAll()
      ]);

      setTodayCodes(codes);
      setStats(statistics);
      setCarriers(carriersList);
      setStores(storesList);
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

          <button
            onClick={() => setActiveTab('stores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'stores'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Store className="w-4 h-4" />
            Tiendas ({stores.length})
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

                {/* Desglose por tienda */}
                <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold text-white mb-4">Por Tienda</h2>

                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(stats.byStore).map(([store, count]) => (
                      <div key={store} className="bg-dark-900 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-white">{count}</div>
                            <div className="text-sm text-gray-400 mt-1">{store}</div>
                          </div>
                          <Store className="w-8 h-8 text-gray-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Códigos recientes */}
                <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold text-white mb-4">Últimos Escaneos de Hoy</h2>

                  <div className="space-y-3">
                    {todayCodes.slice(0, 10).map((code) => (
                      <div
                        key={code.id}
                        className="bg-dark-900 rounded-lg p-4 border border-gray-700 flex items-center justify-between group hover:border-primary-500 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <p className="font-mono font-bold text-white text-lg">{code.code}</p>
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                              {code.carrier_display_name}
                            </span>
                            {code.store_name && (
                              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                {code.store_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mt-2">
                            {new Date(code.created_at).toLocaleString('es-CO')}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteCode(code.id, code.code)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg"
                        >
                          <Trash2 className="w-5 h-5 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Historial Completo */}
            {activeTab === 'history' && (
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">Historial Completo</h2>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {(allCodes.length > 0 ? allCodes : todayCodes).map((code) => (
                    <div
                      key={code.id}
                      className="bg-dark-900 rounded-lg p-4 border border-gray-700 flex items-center justify-between group hover:border-primary-500 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <p className="font-mono font-bold text-white">{code.code}</p>
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                            {code.carrier_display_name}
                          </span>
                          {code.store_name && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                              {code.store_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(code.created_at).toLocaleString('es-CO')}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteCode(code.id, code.code)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
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

            {/* Tab: Tiendas */}
            {activeTab === 'stores' && (
              <div className="bg-dark-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Tiendas Activas</h2>
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                    Agregar Tienda
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="bg-dark-900 rounded-lg p-6 border border-gray-700 text-center"
                    >
                      <Store className="w-12 h-12 text-primary-500 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white">{store.name}</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Creada: {new Date(store.created_at).toLocaleDateString('es-CO')}
                      </p>
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
