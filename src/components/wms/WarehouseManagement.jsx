// =====================================================
// WAREHOUSE MANAGEMENT - Dunamix WMS
// =====================================================
// Desktop: tabla + modal para crear/editar
// Móvil: cards compactas
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { warehousesService } from '../../services/wmsService';
import {
  ArrowLeft, MapPin, Plus, Edit2, Trash2,
  Loader2, Save, X, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const StatusBadge = ({ active }) => active
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold">Activo</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">Inactivo</span>;

export function WarehouseManagement() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null); // null = creating
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', address: '', is_active: true });

  useEffect(() => { loadWarehouses(); }, []);

  async function loadWarehouses() {
    setIsLoading(true);
    try {
      const data = await warehousesService.getAll();
      setWarehouses(data);
    } catch { toast.error('Error al cargar almacenes'); }
    finally { setIsLoading(false); }
  }

  function openCreate() {
    setEditingWarehouse(null);
    setFormData({ code: '', name: '', address: '', is_active: true });
    setShowModal(true);
  }

  function openEdit(wh) {
    setEditingWarehouse(wh);
    setFormData({ code: wh.code, name: wh.name, address: wh.address || '', is_active: wh.is_active });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditingWarehouse(null); }

  async function handleSave() {
    if (!formData.code || !formData.name) { toast.error('Código y nombre son requeridos'); return; }
    setIsSaving(true);
    try {
      if (!editingWarehouse) {
        await warehousesService.create(formData);
        toast.success('Almacén creado');
      } else {
        await warehousesService.update(editingWarehouse.id, formData);
        toast.success('Almacén actualizado');
      }
      closeModal();
      loadWarehouses();
    } catch (error) {
      toast.error(error.message || 'Error al guardar almacén');
    } finally { setIsSaving(false); }
  }

  async function handleDelete(wh) {
    if (!confirm(`¿Eliminar el almacén "${wh.name}"?`)) return;
    try {
      await warehousesService.delete(wh.id);
      toast.success('Almacén eliminado');
      loadWarehouses();
    } catch (error) { toast.error(error.message || 'Error al eliminar almacén'); }
  }

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50 transition-all";

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1200px] mx-auto">

        {/* Volver – solo móvil */}
        <button onClick={() => navigate('/wms')}
          className="lg:hidden mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Barra superior */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4 mb-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-white/40 text-xs">{warehouses.length} almacén{warehouses.length !== 1 ? 'es' : ''} configurado{warehouses.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={loadWarehouses} disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo Almacén
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
          </div>
        )}

        {/* DESKTOP: tabla */}
        {!isLoading && (
          <div className="hidden lg:block bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
            {warehouses.length === 0 ? (
              <div className="p-16 text-center">
                <MapPin className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 mb-4">No hay almacenes creados</p>
                <button onClick={openCreate}
                  className="px-6 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm">
                  Crear primer almacén
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-28">Código</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Dirección</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-24">Estado</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {warehouses.map(wh => (
                    <tr key={wh.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3 font-mono text-white/70 text-xs">{wh.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <span className="text-white/90 font-medium">{wh.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">{wh.address || <span className="text-white/20">—</span>}</td>
                      <td className="px-4 py-3"><StatusBadge active={wh.is_active} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(wh)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-xs">
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => handleDelete(wh)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all text-xs">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MÓVIL: cards */}
        {!isLoading && (
          <div className="lg:hidden space-y-2">
            {warehouses.length === 0 ? (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-10 text-center">
                <MapPin className="w-10 h-10 text-white/20 mx-auto mb-2" />
                <p className="text-white/50 text-sm mb-4">No hay almacenes</p>
                <button onClick={openCreate}
                  className="px-5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm">
                  Crear primer almacén
                </button>
              </div>
            ) : warehouses.map(wh => (
              <div key={wh.id} className="bg-white/5 rounded-xl border border-white/10 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-medium text-sm truncate">{wh.name}</p>
                      <StatusBadge active={wh.is_active} />
                    </div>
                    <p className="text-white/40 text-xs font-mono">{wh.code}</p>
                    {wh.address && <p className="text-white/50 text-xs mt-1">{wh.address}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <button onClick={() => openEdit(wh)}
                      className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(wh)}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODAL - Crear / Editar Almacén
      ══════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base">
                    {editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
                  </h2>
                  {editingWarehouse && <p className="text-white/40 text-xs font-mono">{editingWarehouse.code}</p>}
                </div>
              </div>
              <button onClick={closeModal}
                className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/5 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Código */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Código *</label>
                <input type="text" value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="BOG-001" disabled={!!editingWarehouse}
                  className={`${inputCls} disabled:opacity-50`} />
                {!editingWarehouse && <p className="text-white/30 text-xs mt-1">Identificador único, no se puede cambiar después</p>}
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Nombre *</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Bodega Principal Bogotá"
                  className={inputCls} />
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Dirección</label>
                <input type="text" value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle 123 #45-67, Bogotá"
                  className={inputCls} />
              </div>

              {/* Activo */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="wh_active" checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-2 focus:ring-blue-500/50" />
                <label htmlFor="wh_active" className="text-white/70 text-sm">Almacén activo</label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={closeModal} disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-sm font-medium disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Guardando...' : (editingWarehouse ? 'Guardar Cambios' : 'Crear Almacén')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WarehouseManagement;
