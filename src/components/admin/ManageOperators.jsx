// =====================================================
// MANAGE OPERATORS - Admin Panel
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { companiesService } from '../../services/companiesService';
import { supabase } from '../../services/supabase';
import { ArrowLeft, Plus, User, Edit2, ToggleLeft, ToggleRight, X, Check, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';

export function ManageOperators() {
  const navigate = useNavigate();
  const { companyId, operatorId } = useStore();

  const [operators, setOperators] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOp, setEditingOp] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', warehouseIds: [] });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      Promise.all([loadOperators(), loadWarehouses()]);
    }
  }, [companyId]);

  async function loadOperators() {
    setIsLoading(true);
    try {
      const data = await companiesService.getOperators(companyId);
      // Excluir al admin actual de la lista
      setOperators(data.filter(op => op.id !== operatorId));
    } catch (err) {
      toast.error('Error al cargar operadores');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWarehouses() {
    try {
      const data = await companiesService.getWarehouses(companyId);
      setWarehouses(data.filter(w => w.is_active));
    } catch (err) {
      console.error('Error al cargar bodegas:', err);
    }
  }

  function openCreate() {
    setForm({ name: '', email: '', password: '', warehouseIds: [] });
    setEditingOp(null);
    setShowForm(true);
  }

  function openEdit(op) {
    const currentWarehouses = (op.operator_warehouses || []).map(ow => ow.warehouse_id);
    setForm({ name: op.name, email: op.email || '', password: '', warehouseIds: currentWarehouses });
    setEditingOp(op);
    setShowForm(true);
  }

  function toggleWarehouse(warehouseId) {
    setForm(f => ({
      ...f,
      warehouseIds: f.warehouseIds.includes(warehouseId)
        ? f.warehouseIds.filter(id => id !== warehouseId)
        : [...f.warehouseIds, warehouseId]
    }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }

    setIsSaving(true);
    try {
      if (editingOp) {
        // Solo actualizar bodegas asignadas
        await companiesService.setOperatorWarehouses(editingOp.id, form.warehouseIds);
        toast.success('Operador actualizado');
      } else {
        // Crear nuevo usuario en Supabase Auth
        if (!form.password || form.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          setIsSaving(false);
          return;
        }

        // Crear cuenta en Auth (usando signUp desde el cliente)
        // NOTA: Esto crea la cuenta pero requiere que el usuario confirme el email
        // En producción usar Supabase Admin SDK para evitar confirmación
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { name: form.name.trim() }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // Sincronizar operador y asignarlo a la empresa
          await supabase.rpc('sync_operator_on_login', {
            user_id: authData.user.id,
            user_email: form.email.trim(),
            user_name: form.name.trim()
          });

          await companiesService.assignOperatorToCompany(
            operatorId,
            authData.user.id,
            form.warehouseIds
          );
        }

        toast.success(`Operador creado. El usuario debe confirmar su email: ${form.email}`);
      }

      setShowForm(false);
      loadOperators();
    } catch (err) {
      toast.error(err.message || 'Error al guardar operador');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(op) {
    try {
      if (op.is_active) {
        await companiesService.deactivateOperator(op.id);
      } else {
        await companiesService.reactivateOperator(op.id);
      }
      setOperators(prev => prev.map(o => o.id === op.id ? { ...o, is_active: !op.is_active } : o));
      toast.success(op.is_active ? 'Operador desactivado' : 'Operador activado');
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
            <h1 className="text-2xl font-bold text-white">Operadores</h1>
            <p className="text-white/60 text-sm">{operators.length} operadores</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6">
            <h3 className="text-white font-bold mb-4">{editingOp ? 'Editar Operador' : 'Nuevo Operador'}</h3>
            <div className="space-y-4">
              {!editingOp && (
                <>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Nombre *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Juan Pérez"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-green-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="operador@empresa.com"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-green-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Contraseña (mín. 6 caracteres) *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-green-400 transition-all"
                    />
                  </div>
                </>
              )}

              {/* Warehouse assignment */}
              {warehouses.length > 0 && (
                <div>
                  <label className="text-white/60 text-xs mb-2 block flex items-center gap-1">
                    <Warehouse className="w-3 h-3" /> Bodegas asignadas
                  </label>
                  <div className="space-y-2">
                    {warehouses.map(wh => (
                      <label key={wh.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                        <input
                          type="checkbox"
                          checked={form.warehouseIds.includes(wh.id)}
                          onChange={() => toggleWarehouse(wh.id)}
                          className="w-4 h-4 accent-blue-500"
                        />
                        <span className="text-white text-sm">{wh.name}</span>
                        <span className="text-white/40 text-xs font-mono ml-auto">{wh.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-green-600 transition-all disabled:opacity-50"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingOp ? 'Guardar' : 'Crear'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all">
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
        ) : operators.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay operadores. Crea el primero.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {operators.map(op => {
              const opWarehouses = (op.operator_warehouses || []).map(ow => ow.warehouses?.name).filter(Boolean);
              return (
                <div
                  key={op.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    op.is_active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-60'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-green-500/20">
                    <User className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{op.name}</p>
                    <p className="text-white/50 text-xs truncate">{op.email}</p>
                    {opWarehouses.length > 0 && (
                      <p className="text-blue-300/60 text-xs mt-0.5 truncate">
                        {opWarehouses.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(op)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(op)}
                      className={`p-2 rounded-lg transition-all ${op.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-white/30 hover:bg-white/10'}`}
                    >
                      {op.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageOperators;
