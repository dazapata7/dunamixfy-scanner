import { useEffect, useState } from 'react';
import { ArrowLeft, Store, TruckIcon, Users, Plus, Trash2, Edit } from 'lucide-react';
import { carriersService, storesService } from '../services/supabase';
import toast from 'react-hot-toast';

export function ConfigPanel({ onBack }) {
  const [activeTab, setActiveTab] = useState('stores'); // stores, carriers, users
  const [stores, setStores] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [storesList, carriersList] = await Promise.all([
        storesService.getAll(),
        carriersService.getAll()
      ]);

      setStores(storesList);
      setCarriers(carriersList);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando configuración');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-300 hover:text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Configuración del Sistema</h1>
              <p className="text-sm text-gray-400 mt-1">Gestiona tiendas, transportadoras y usuarios</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-dark-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex gap-1 p-2">
          <button
            onClick={() => setActiveTab('stores')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'stores'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Store className="w-5 h-5" />
            Tiendas ({stores.length})
          </button>

          <button
            onClick={() => setActiveTab('carriers')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'carriers'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <TruckIcon className="w-5 h-5" />
            Transportadoras ({carriers.length})
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
              activeTab === 'users'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <Users className="w-5 h-5" />
            Usuarios
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">Cargando configuración...</p>
          </div>
        ) : (
          <>
            {/* Tab: Tiendas */}
            {activeTab === 'stores' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Gestión de Tiendas</h2>
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                    <Plus className="w-5 h-5" />
                    Agregar Tienda
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="bg-dark-800 rounded-xl p-6 border border-gray-700 hover:border-primary-500 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <Store className="w-10 h-10 text-primary-500" />
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors">
                            <Edit className="w-4 h-4 text-blue-400" />
                          </button>
                          <button className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{store.name}</h3>
                      <p className="text-sm text-gray-400">
                        Creada: {new Date(store.created_at).toLocaleDateString('es-CO')}
                      </p>
                      {!store.is_active && (
                        <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                          Inactiva
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Transportadoras */}
            {activeTab === 'carriers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Gestión de Transportadoras</h2>
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                    <Plus className="w-5 h-5" />
                    Agregar Transportadora
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {carriers.map((carrier) => (
                    <div
                      key={carrier.id}
                      className="bg-dark-800 rounded-xl p-6 border border-gray-700 hover:border-primary-500 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <TruckIcon className="w-12 h-12 text-primary-500" />
                          <div>
                            <h3 className="text-xl font-bold text-white">{carrier.display_name}</h3>
                            <p className="text-sm text-gray-400">Código: {carrier.code}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors">
                            <Edit className="w-4 h-4 text-blue-400" />
                          </button>
                          <button className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <div className="bg-dark-900 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Reglas de Validación</p>
                          <p className="text-sm text-gray-300 font-mono truncate">
                            {carrier.validation_rules?.pattern || 'Sin patrón definido'}
                          </p>
                        </div>

                        {carrier.extraction_config && (
                          <div className="bg-dark-900 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Configuración de Extracción</p>
                            <p className="text-sm text-green-400">✓ Configurada</p>
                          </div>
                        )}

                        {!carrier.is_active && (
                          <span className="inline-block px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                            Inactiva
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Usuarios */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors">
                    <Plus className="w-5 h-5" />
                    Invitar Usuario
                  </button>
                </div>

                <div className="bg-dark-800 rounded-xl p-8 border border-gray-700 text-center">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Sistema de Autenticación Próximamente</h3>
                  <p className="text-gray-400">
                    La gestión de usuarios con Google Auth y contraseñas estará disponible próximamente
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
