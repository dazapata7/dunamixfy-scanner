// =====================================================
// WAREHOUSE MANAGEMENT - Dunamix WMS
// =====================================================
// Gestión completa de almacenes: Crear, Editar, Eliminar
// Solo para administradores
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { warehousesService } from '../../services/wmsService';
import {
  ArrowLeft,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export function WarehouseManagement() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    is_active: true
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouses() {
    setIsLoading(true);
    try {
      const data = await warehousesService.getAll();
      setWarehouses(data);
    } catch (error) {
      console.error('❌ Error al cargar almacenes:', error);
      toast.error('Error al cargar almacenes');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCreate() {
    setIsCreating(true);
    setEditingWarehouse(null);
    setFormData({
      code: '',
      name: '',
      address: '',
      is_active: true
    });
  }

  function handleEdit(warehouse) {
    setIsCreating(false);
    setEditingWarehouse(warehouse.id);
    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address || '',
      is_active: warehouse.is_active
    });
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingWarehouse(null);
    setFormData({
      code: '',
      name: '',
      address: '',
      is_active: true
    });
  }

  async function handleSave() {
    // Validaciones
    if (!formData.code || !formData.name) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    try {
      if (isCreating) {
        // Crear nuevo
        await warehousesService.create(formData);
        toast.success('Almacén creado exitosamente');
      } else {
        // Actualizar existente
        await warehousesService.update(editingWarehouse, formData);
        toast.success('Almacén actualizado exitosamente');
      }

      handleCancel();
      loadWarehouses();
    } catch (error) {
      console.error('❌ Error al guardar almacén:', error);
      toast.error(error.message || 'Error al guardar almacén');
    }
  }

  async function handleDelete(warehouse) {
    if (!confirm(`¿Estás seguro de eliminar el almacén "${warehouse.name}"?`)) {
      return;
    }

    try {
      await warehousesService.delete(warehouse.id);
      toast.success('Almacén eliminado');
      loadWarehouses();
    } catch (error) {
      console.error('❌ Error al eliminar almacén:', error);
      toast.error(error.message || 'Error al eliminar almacén');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-4xl mx-auto">

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-blue-500/20">
                <MapPin className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Gestión de Almacenes
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  Crear, editar y eliminar almacenes
                </p>
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nuevo Almacén
            </button>
          </div>
        </div>

        {/* Form (Crear o Editar) */}
        {(isCreating || editingWarehouse) && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {isCreating ? 'Crear Almacén' : 'Editar Almacén'}
            </h2>

            <div className="space-y-4">
              {/* Código */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Código * <span className="text-white/40">(ej: BOG-001)</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="BOG-001"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  disabled={!isCreating} // No permitir cambiar código en edición
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Bodega Principal Bogotá"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Dirección (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle 123 #45-67, Bogotá"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Activo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                />
                <label htmlFor="is_active" className="text-white/80 text-sm">
                  Almacén activo
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all"
                >
                  <Save className="w-5 h-5" />
                  Guardar
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
          </div>
        )}

        {/* Warehouses List */}
        {!isLoading && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <h2 className="text-xl font-bold text-white mb-4">
              Almacenes ({warehouses.length})
            </h2>

            {warehouses.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/40">No hay almacenes creados</p>
                <button
                  onClick={handleCreate}
                  className="mt-4 px-6 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
                >
                  Crear primer almacén
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {warehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className="bg-white/5 rounded-2xl border border-white/10 p-4 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white">
                            {warehouse.name}
                          </h3>
                          {warehouse.is_active ? (
                            <span className="px-2 py-0.5 rounded-lg text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                              Activo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-white/40 text-sm mb-1">
                          Código: {warehouse.code}
                        </p>
                        {warehouse.address && (
                          <p className="text-white/60 text-sm">
                            {warehouse.address}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(warehouse)}
                          className="p-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(warehouse)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default WarehouseManagement;
