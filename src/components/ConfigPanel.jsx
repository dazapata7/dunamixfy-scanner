import { useEffect, useState } from 'react';
import { ArrowLeft, Store, TruckIcon, Users, Plus, Trash2, Edit, X } from 'lucide-react';
import { storesService } from '../services/storesService';
import { carriersService } from '../services/carriersService';
import toast from 'react-hot-toast';

export function ConfigPanel({ onBack }) {
  const [activeTab, setActiveTab] = useState('stores');
  const [stores, setStores] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [editingCarrier, setEditingCarrier] = useState(null);

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

  // ========== STORES CRUD ==========
  const handleAddStore = () => {
    setEditingStore(null);
    setShowStoreModal(true);
  };

  const handleEditStore = (store) => {
    setEditingStore(store);
    setShowStoreModal(true);
  };

  const handleSaveStore = async (storeData) => {
    try {
      if (editingStore) {
        await storesService.update(editingStore.id, storeData);
        toast.success('Tienda actualizada');
      } else {
        await storesService.create(storeData);
        toast.success('Tienda creada');
      }
      setShowStoreModal(false);
      loadData();
    } catch (error) {
      console.error('Error guardando tienda:', error);
      toast.error(error.message || 'Error al guardar tienda');
    }
  };

  const handleDeleteStore = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta tienda?')) return;

    try {
      await storesService.delete(id);
      toast.success('Tienda eliminada');
      loadData();
    } catch (error) {
      console.error('Error eliminando tienda:', error);
      toast.error('Error al eliminar tienda');
    }
  };

  // ========== CARRIERS CRUD ==========
  const handleAddCarrier = () => {
    setEditingCarrier(null);
    setShowCarrierModal(true);
  };

  const handleEditCarrier = (carrier) => {
    setEditingCarrier(carrier);
    setShowCarrierModal(true);
  };

  const handleSaveCarrier = async (carrierData) => {
    try {
      if (editingCarrier) {
        await carriersService.update(editingCarrier.id, carrierData);
        toast.success('Transportadora actualizada');
      } else {
        await carriersService.create(carrierData);
        toast.success('Transportadora creada');
      }
      setShowCarrierModal(false);
      loadData();
    } catch (error) {
      console.error('Error guardando transportadora:', error);
      toast.error(error.message || 'Error al guardar transportadora');
    }
  };

  const handleDeleteCarrier = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta transportadora?')) return;

    try {
      await carriersService.delete(id);
      toast.success('Transportadora eliminada');
      loadData();
    } catch (error) {
      console.error('Error eliminando transportadora:', error);
      toast.error('Error al eliminar transportadora');
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
                  <button
                    onClick={handleAddStore}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Agregar Tienda
                  </button>
                </div>

                {stores.length === 0 ? (
                  <div className="bg-dark-800 rounded-xl p-12 border border-gray-700 text-center">
                    <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No hay tiendas registradas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stores.map((store) => (
                      <div
                        key={store.id}
                        className="bg-dark-800 rounded-xl p-6 border border-gray-700 hover:border-primary-500 transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <Store className="w-10 h-10 text-primary-500" />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditStore(store)}
                              className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteStore(store.id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{store.name}</h3>
                        {store.code && (
                          <p className="text-sm text-gray-400 mb-1">Código: {store.code}</p>
                        )}
                        {store.city && (
                          <p className="text-sm text-gray-400 mb-1">Ciudad: {store.city}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Creada: {new Date(store.created_at).toLocaleDateString('es-CO')}
                        </p>
                        {!store.active && (
                          <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                            Inactiva
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Transportadoras */}
            {activeTab === 'carriers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Gestión de Transportadoras</h2>
                  <button
                    onClick={handleAddCarrier}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Agregar Transportadora
                  </button>
                </div>

                {carriers.length === 0 ? (
                  <div className="bg-dark-800 rounded-xl p-12 border border-gray-700 text-center">
                    <TruckIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No hay transportadoras registradas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {carriers.map((carrier) => (
                      <div
                        key={carrier.id}
                        className="bg-dark-800 rounded-xl p-6 border border-gray-700 hover:border-primary-500 transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <TruckIcon className="w-12 h-12 text-primary-500" />
                            <div>
                              <h3 className="text-xl font-bold text-white">{carrier.name}</h3>
                              {carrier.code && (
                                <p className="text-sm text-gray-400">Código: {carrier.code}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditCarrier(carrier)}
                              className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteCarrier(carrier.id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {carrier.contact_name && (
                          <div className="mt-4 space-y-1 text-sm">
                            <p className="text-gray-400">Contacto: {carrier.contact_name}</p>
                            {carrier.contact_phone && (
                              <p className="text-gray-400">Tel: {carrier.contact_phone}</p>
                            )}
                            {carrier.contact_email && (
                              <p className="text-gray-400">Email: {carrier.contact_email}</p>
                            )}
                          </div>
                        )}

                        {!carrier.active && (
                          <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                            Inactiva
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Usuarios */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
                </div>

                <div className="bg-dark-800 rounded-xl p-8 border border-gray-700 text-center">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Gestión de Usuarios</h3>
                  <p className="text-gray-400">
                    Los usuarios se registran automáticamente con rol de Operador.
                    <br />
                    Para asignar rol de Admin, usa SQL en Supabase.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Tienda */}
      {showStoreModal && (
        <StoreModal
          store={editingStore}
          onSave={handleSaveStore}
          onClose={() => setShowStoreModal(false)}
        />
      )}

      {/* Modal: Transportadora */}
      {showCarrierModal && (
        <CarrierModal
          carrier={editingCarrier}
          onSave={handleSaveCarrier}
          onClose={() => setShowCarrierModal(false)}
        />
      )}
    </div>
  );
}

// ========== MODAL: STORE ==========
function StoreModal({ store, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: store?.name || '',
    code: store?.code || '',
    address: store?.address || '',
    city: store?.city || '',
    phone: store?.phone || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {store ? 'Editar Tienda' : 'Nueva Tienda'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Código
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ciudad
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dirección
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              {store ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== MODAL: CARRIER ==========
function CarrierModal({ carrier, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: carrier?.name || '',
    code: carrier?.code || '',
    contact_name: carrier?.contact_name || '',
    contact_email: carrier?.contact_email || '',
    contact_phone: carrier?.contact_phone || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {carrier ? 'Editar Transportadora' : 'Nueva Transportadora'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Código
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre de Contacto
            </label>
            <input
              type="text"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email de Contacto
            </label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Teléfono de Contacto
            </label>
            <input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              {carrier ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
