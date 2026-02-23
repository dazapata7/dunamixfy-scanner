// =====================================================
// MANAGE BODEGAS - Admin Panel
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { companiesService } from '../../services/companiesService';
import { ArrowLeft, Plus, Warehouse, Edit2, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function ManageBodegas() {
  const navigate = useNavigate();
  const { companyId } = useStore();

  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', address: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (companyId) loadWarehouses(); }, [companyId]);

  async function loadWarehouses() {
    setIsLoading(true);
    try {
      const data = await companiesService.getWarehouses(companyId);
      setWarehouses(data);
    } catch (err) {
      toast.error('Error al cargar bodegas');
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setForm({ code: '', name: '', address: '' });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(wh) {
    setForm({ code: wh.code, name: wh.name, address: wh.address || '' });
    setEditingId(wh.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Código y nombre son requeridos');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await companiesService.updateWarehouse(editingId, {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          address: form.address.trim() || null
        });
        toast.success('Bodega actualizada');
      } else {
        await companiesService.createWarehouse(companyId, {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          address: form.address.trim() || null,
          is_active: true
        });
        toast.success('Bodega creada');
      }
      setShowForm(false);
      loadWarehouses();
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(wh) {
    try {
      await companiesService.updateWarehouse(wh.id, { is_active: !wh.is_active });
      setWarehouses(prev => prev.map(w => w.id === wh.id ? { ...w, is_active: !wh.is_active } : w));
      toast.success(wh.is_active ? 'Bodega desactivada' : 'Bodega activada');
    } catch (err) {
      toast.error('Error al actualizar');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Bodegas</h1>
            <p className="text-white/60 text-sm">{warehouses.length} bodegas registradas</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6">
            <h3 className="text-white font-bold mb-4">{editingId ? 'Editar Bodega' : 'Nueva Bodega'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Código *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="BOG-001"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Bodega Principal Bogotá"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Dirección</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Calle 123 #45-67, Bogotá"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'Guardar' : 'Crear'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : warehouses.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay bodegas. Crea la primera.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {warehouses.map(wh => (
              <div
                key={wh.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  wh.is_active
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white/2 border-white/5 opacity-60'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-blue-500/20">
                  <Warehouse className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{wh.name}</p>
                  <p className="text-white/50 text-xs font-mono">{wh.code}</p>
                  {wh.address && <p className="text-white/40 text-xs truncate">{wh.address}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(wh)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(wh)}
                    className={`p-2 rounded-lg transition-all ${wh.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-white/30 hover:bg-white/10'}`}
                  >
                    {wh.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageBodegas;
