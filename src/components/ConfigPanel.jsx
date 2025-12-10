import { useEffect, useState } from 'react';
import { ArrowLeft, TruckIcon, Users, Plus, Trash2, Edit, X } from 'lucide-react';
import { carriersService } from '../services/supabase';
import toast from 'react-hot-toast';

export function ConfigPanel({ onBack }) {
  const [activeTab, setActiveTab] = useState('carriers');
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const carriersList = await carriersService.getAll();
      setCarriers(carriersList);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando configuración');
    } finally {
      setIsLoading(false);
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
      await carriersService.upsert(carrierData);
      toast.success(editingCarrier ? 'Transportadora actualizada' : 'Transportadora creada');
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
      // V3: Solo marcar como inactiva, no eliminar físicamente
      await carriersService.upsert({ id, is_active: false });
      toast.success('Transportadora desactivada');
      loadData();
    } catch (error) {
      console.error('Error desactivando transportadora:', error);
      toast.error('Error al desactivar transportadora');
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
                              <h3 className="text-xl font-bold text-white">{carrier.display_name}</h3>
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

                        <div className="mt-4 space-y-1 text-sm">
                          <p className="text-gray-400">
                            Reglas de validación: {JSON.stringify(carrier.validation_rules).length} caracteres
                          </p>
                          {carrier.extraction_config && (
                            <p className="text-gray-400">
                              Config extracción: Sí
                            </p>
                          )}
                        </div>

                        {!carrier.is_active && (
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

// ========== MODAL: CARRIER ==========
function CarrierModal({ carrier, onSave, onClose }) {
  const [formData, setFormData] = useState({
    display_name: carrier?.display_name || '',
    code: carrier?.code || '',
    validation_rules: carrier?.validation_rules ? JSON.stringify(carrier.validation_rules, null, 2) : '{}',
    extraction_config: carrier?.extraction_config ? JSON.stringify(carrier.extraction_config, null, 2) : null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        validation_rules: JSON.parse(formData.validation_rules),
        extraction_config: formData.extraction_config ? JSON.parse(formData.extraction_config) : null
      };
      onSave(dataToSave);
    } catch (error) {
      toast.error('Error en formato JSON: ' + error.message);
    }
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
              Nombre para mostrar *
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Código *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reglas de validación (JSON) *
            </label>
            <textarea
              value={formData.validation_rules}
              onChange={(e) => setFormData({ ...formData, validation_rules: e.target.value })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              rows={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Config extracción (JSON, opcional)
            </label>
            <textarea
              value={formData.extraction_config || ''}
              onChange={(e) => setFormData({ ...formData, extraction_config: e.target.value || null })}
              className="w-full px-4 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              rows={4}
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
