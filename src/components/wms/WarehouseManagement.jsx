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
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400/80 text-xs font-semibold">Activo</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400/80 text-xs font-semibold">Inactivo</span>;

const inputCls = "bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full";

export function WarehouseManagement() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
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

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1200px] mx-auto space-y-5">

        {/* Volver – solo móvil */}
        <button onClick={() => navigate('/wms')}
          className="lg:hidden bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Barra superior */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-white/40 text-xs">{warehouses.length} almacén{warehouses.length !== 1 ? 'es' : ''} configurado{warehouses.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={loadWarehouses} disabled={isLoading}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate}
            className="bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nuevo Almacén
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}

        {/* DESKTOP: tabla */}
        {!isLoading && (
          <div className="hidden lg:block bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
            {warehouses.length === 0 ? (
              <div className="py-16 text-center">
                <MapPin className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm mb-4">No hay almacenes creados</p>
                <button onClick={openCreate}
                  className="bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 text-sm">
                  Crear primer almacén
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-black/20">
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-28">Código</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Nombre</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Dirección</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Estado</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {warehouses.map(wh => (
                    <tr key={wh.id} className="hover:bg-primary-500/[0.03] transition-colors group">
                      <td className="px-4 py-3 font-mono text-white/40 text-xs">{wh.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-primary-400" />
                          </div>
                          <span className="text-white font-medium text-sm">{wh.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-sm">{wh.address || <span className="text-white/20">—</span>}</td>
                      <td className="px-4 py-3"><StatusBadge active={wh.is_active} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(wh)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(wh)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
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
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08]">
                <div className="py-16 text-center">
                  <MapPin className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm mb-4">No hay almacenes</p>
                  <button onClick={openCreate}
                    className="bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 text-sm">
                    Crear primer almacén
                  </button>
                </div>
              </div>
            ) : warehouses.map(wh => (
              <div key={wh.id} className="bg-dark-800 rounded-2xl border border-white/[0.08] p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-medium text-sm truncate">{wh.name}</p>
                      <StatusBadge active={wh.is_active} />
                    </div>
                    <p className="text-white/40 text-xs font-mono">{wh.code}</p>
                    {wh.address && <p className="text-white/60 text-xs mt-1">{wh.address}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <button onClick={() => openEdit(wh)}
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(wh)}
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-2xl border border-white/[0.08] w-full max-w-lg shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h2 className="text-white font-semibold text-base">
                {editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}
              </h2>
              <button onClick={closeModal}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Código *</label>
                <input type="text" value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="BOG-001" disabled={!!editingWarehouse}
                  className={`${inputCls} disabled:opacity-50`} />
                {!editingWarehouse && <p className="text-white/30 text-xs mt-1">Identificador único, no se puede cambiar después</p>}
              </div>

              <div>
                <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Nombre *</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Bodega Principal Bogotá"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Dirección</label>
                <input type="text" value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle 123 #45-67, Bogotá"
                  className={inputCls} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="wh_active" checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/[0.04] border-white/[0.08] text-primary-500 focus:ring-2 focus:ring-primary-500/30" />
                <label htmlFor="wh_active" className="text-white/60 text-sm">Almacén activo</label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-white/[0.06]">
              <button onClick={closeModal} disabled={isSaving}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                {isSaving
                  ? <><div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4" /> {editingWarehouse ? 'Guardar Cambios' : 'Crear Almacén'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WarehouseManagement;
