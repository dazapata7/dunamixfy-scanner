// =====================================================
// MANAGE OPERATORS - Admin Panel
// =====================================================
// Gestión completa: crear, editar bodegas,
// configurar permisos granulares y cambiar roles.
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { companiesService } from '../../services/companiesService';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft, Plus, User, Edit2, ToggleLeft, ToggleRight,
  X, Check, Warehouse, Shield, ShieldCheck, ShieldAlert,
  Scan, Trash2, BarChart3, Upload, Tag,
  RotateCcw, Factory, ChevronUp, Crown
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Definición de permisos ────────────────────────
const PERMISSIONS_DEF = [
  { key: 'can_scan',              label: 'Escanear guías',      icon: Scan,      desc: 'Acceso al escáner de despachos'         },
  { key: 'can_confirm_batch',     label: 'Confirmar lote',      icon: Check,     desc: 'Aprobar y confirmar batches de escaneo' },
  { key: 'can_delete_dispatch',   label: 'Eliminar despachos',  icon: Trash2,    desc: 'Borrar despachos (acción irreversible)' },
  { key: 'can_manage_returns',    label: 'Devoluciones',        icon: RotateCcw, desc: 'Registrar y gestionar devoluciones'     },
  { key: 'can_import_csv',        label: 'Importar CSV',        icon: Upload,    desc: 'Importar guías desde archivos CSV'      },
  { key: 'can_view_reports',      label: 'Ver reportes',        icon: BarChart3, desc: 'Acceso a dashboards e historial'        },
  { key: 'can_manage_products',   label: 'Gestionar productos', icon: Tag,       desc: 'Crear, editar y eliminar productos'     },
  { key: 'can_manage_production', label: 'Producción',          icon: Factory,   desc: 'Gestionar órdenes de fabricación'       },
];

const DEFAULT_PERMISSIONS = {
  can_scan: true, can_confirm_batch: true, can_delete_dispatch: false,
  can_view_reports: false, can_import_csv: false, can_manage_products: false,
  can_manage_returns: true, can_manage_production: false,
};

// ── Helpers visuales ──────────────────────────────
function RoleBadge({ role }) {
  const cfg = {
    superadmin: { label: 'Superadmin', cls: 'bg-purple-500/20 border-purple-500/30 text-purple-300', Icon: Crown },
    admin:      { label: 'Admin',      cls: 'bg-blue-500/20 border-blue-500/30 text-blue-300',       Icon: ShieldCheck },
    operator:   { label: 'Operador',   cls: 'bg-primary-500/15 border-primary-500/30 text-primary-400', Icon: Shield },
  }[role] || { label: role, cls: 'bg-white/10 border-white/20 text-white/60', Icon: User };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function PermissionToggle({ permKey, label, icon: Icon, desc, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      disabled ? 'opacity-40 cursor-not-allowed' :
      checked  ? 'bg-primary-500/10 border-primary-500/30 cursor-pointer'
               : 'bg-white/[0.03] border-white/[0.06] cursor-pointer hover:bg-white/[0.06]'
    }`}>
      <div className={`p-1.5 rounded-lg flex-shrink-0 ${checked ? 'bg-primary-500/20 text-primary-400' : 'bg-white/5 text-white/30'}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? 'text-white' : 'text-white/50'}`}>{label}</p>
        <p className="text-xs text-white/30 truncate">{desc}</p>
      </div>
      <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary-500' : 'bg-white/10'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        <input type="checkbox" className="sr-only" checked={checked}
          onChange={e => !disabled && onChange(permKey, e.target.checked)} disabled={disabled} />
      </div>
    </label>
  );
}

function SaveBtn({ onClick, loading, label = 'Guardar', disabled }) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className="w-full py-2.5 rounded-xl bg-primary-500 text-dark-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-400 transition-all disabled:opacity-50 mt-3">
      {loading
        ? <div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
        : <Check className="w-4 h-4" />}
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════
export function ManageOperators() {
  const navigate = useNavigate();
  const { companyId, operatorId, role: myRole } = useStore();
  const isSuperAdmin = myRole === 'superadmin';

  const [operators,  setOperators]  = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);

  // Crear
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', warehouseIds: [] });
  const [isCreating, setIsCreating] = useState(false);

  // Panel expandido
  const [expandedId,   setExpandedId]   = useState(null);
  const [activeTab,    setActiveTab]    = useState('bodegas');
  const [editWH,       setEditWH]       = useState([]);
  const [editPerms,    setEditPerms]    = useState({});
  const [editRole,     setEditRole]     = useState('operator');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (companyId) { loadOperators(); loadWarehouses(); }
  }, [companyId]);

  async function loadOperators() {
    setIsLoading(true);
    try {
      const data = await companiesService.getOperators(companyId);
      setOperators(data.filter(op => op.id !== operatorId));
    } catch { toast.error('Error al cargar operadores'); }
    finally { setIsLoading(false); }
  }

  async function loadWarehouses() {
    try {
      const data = await companiesService.getWarehouses(companyId);
      setWarehouses(data.filter(w => w.is_active));
    } catch (err) { console.error(err); }
  }

  // ── Expandir ──────────────────────────────────
  function toggleExpand(op) {
    if (expandedId === op.id) { setExpandedId(null); return; }
    setExpandedId(op.id);
    setActiveTab('bodegas');
    setEditWH((op.operator_warehouses || []).map(ow => ow.warehouse_id));
    setEditPerms({ ...DEFAULT_PERMISSIONS, ...(op.permissions || {}) });
    setEditRole(op.role || 'operator');
  }

  // ── Guardar bodegas ───────────────────────────
  async function saveBodegas(op) {
    setIsSavingEdit(true);
    try {
      await companiesService.setOperatorWarehouses(op.id, editWH);
      toast.success('Bodegas actualizadas');
      loadOperators(); setExpandedId(null);
    } catch (err) { toast.error(err.message || 'Error'); }
    finally { setIsSavingEdit(false); }
  }

  // ── Guardar permisos ──────────────────────────
  async function savePermisos(op) {
    setIsSavingEdit(true);
    try {
      await companiesService.updateOperatorPermissions(op.id, editPerms);
      toast.success('Permisos actualizados');
      setOperators(prev => prev.map(o => o.id === op.id ? { ...o, permissions: editPerms } : o));
      setExpandedId(null);
    } catch (err) { toast.error(err.message || 'Error'); }
    finally { setIsSavingEdit(false); }
  }

  // ── Guardar rol ───────────────────────────────
  async function saveRol(op) {
    if (editRole === op.role) { setExpandedId(null); return; }
    setIsSavingEdit(true);
    try {
      await companiesService.setOperatorRole(op.id, editRole);
      toast.success(`Rol cambiado a ${editRole}`);
      setOperators(prev => prev.map(o => o.id === op.id ? { ...o, role: editRole } : o));
      setExpandedId(null);
    } catch (err) { toast.error(err.message || 'Error al cambiar rol'); }
    finally { setIsSavingEdit(false); }
  }

  // ── Toggle activo ─────────────────────────────
  async function toggleActive(op) {
    try {
      op.is_active
        ? await companiesService.deactivateOperator(op.id)
        : await companiesService.reactivateOperator(op.id);
      setOperators(prev => prev.map(o => o.id === op.id ? { ...o, is_active: !op.is_active } : o));
      toast.success(op.is_active ? 'Operador desactivado' : 'Operador activado');
    } catch { toast.error('Error al actualizar estado'); }
  }

  // ── Crear ─────────────────────────────────────
  async function handleCreate() {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error('Nombre y email son requeridos'); return;
    }
    if (createForm.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres'); return;
    }
    setIsCreating(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createForm.email.trim(),
        password: createForm.password,
        options: { data: { name: createForm.name.trim() } }
      });
      if (authError) throw authError;
      if (authData.user) {
        await supabase.rpc('sync_operator_on_login', {
          user_id: authData.user.id,
          user_email: createForm.email.trim(),
          user_name: createForm.name.trim()
        });
        await companiesService.assignOperatorToCompany(operatorId, authData.user.id, createForm.warehouseIds);
      }
      toast.success('Operador creado — debe confirmar su email.');
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', warehouseIds: [] });
      loadOperators();
    } catch (err) { toast.error(err.message || 'Error al crear operador'); }
    finally { setIsCreating(false); }
  }

  const countActivePerms = (op) =>
    Object.values({ ...DEFAULT_PERMISSIONS, ...(op.permissions || {}) }).filter(Boolean).length;

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-4 lg:p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')}
            className="p-2 rounded-xl bg-white/5 border border-white/[0.06] text-white/60 hover:bg-white/10 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Operadores</h1>
            <p className="text-white/40 text-sm">{operators.length} operador{operators.length !== 1 ? 'es' : ''}</p>
          </div>
          <button onClick={() => { setShowCreate(true); setExpandedId(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/20 border border-primary-500/30 text-primary-400 hover:bg-primary-500/30 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {/* ── Formulario Crear ─────────────────── */}
        {showCreate && (
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary-400" /> Nuevo Operador
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nombre *', key: 'name', type: 'text', ph: 'Juan Pérez' },
                { label: 'Email *',  key: 'email', type: 'email', ph: 'operador@empresa.com' },
                { label: 'Contraseña * (mín. 6 caracteres)', key: 'password', type: 'password', ph: '••••••••' },
              ].map(({ label, key, type, ph }) => (
                <div key={key}>
                  <label className="text-white/50 text-xs mb-1 block">{label}</label>
                  <input type={type} value={createForm[key]} placeholder={ph}
                    onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder-white/20 focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
              ))}

              {warehouses.length > 0 && (
                <div>
                  <label className="text-white/50 text-xs mb-2 block flex items-center gap-1">
                    <Warehouse className="w-3 h-3" /> Bodegas asignadas
                  </label>
                  <div className="space-y-1.5">
                    {warehouses.map(wh => (
                      <label key={wh.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-all">
                        <input type="checkbox" className="w-4 h-4 accent-primary-500 rounded"
                          checked={createForm.warehouseIds.includes(wh.id)}
                          onChange={() => setCreateForm(f => ({
                            ...f,
                            warehouseIds: f.warehouseIds.includes(wh.id)
                              ? f.warehouseIds.filter(id => id !== wh.id)
                              : [...f.warehouseIds, wh.id]
                          }))} />
                        <span className="text-white text-sm flex-1">{wh.name}</span>
                        <span className="text-white/30 text-xs font-mono">{wh.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleCreate} disabled={isCreating}
                  className="flex-1 py-2.5 rounded-xl bg-primary-500 text-dark-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-400 transition-all disabled:opacity-50">
                  {isCreating
                    ? <div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
                    : <Check className="w-4 h-4" />}
                  Crear operador
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.08] transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Lista ────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay operadores. Crea el primero.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {operators.map(op => {
              const opWH = (op.operator_warehouses || []).map(ow => ow.warehouses?.name).filter(Boolean);
              const isExpanded = expandedId === op.id;
              const isAdminRole = op.role === 'admin' || op.role === 'superadmin';

              return (
                <div key={op.id} className={`rounded-2xl border transition-all ${
                  op.is_active ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white/[0.015] border-white/[0.04] opacity-50'
                } ${isExpanded ? 'ring-1 ring-primary-500/20' : ''}`}>

                  {/* Fila principal */}
                  <div className="flex items-center gap-3 p-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      op.role === 'superadmin' ? 'bg-purple-500/20' :
                      op.role === 'admin'      ? 'bg-blue-500/20'   : 'bg-primary-500/15'
                    }`}>
                      {op.role === 'superadmin' ? <Crown className="w-4 h-4 text-purple-400" /> :
                       op.role === 'admin'      ? <ShieldCheck className="w-4 h-4 text-blue-400" /> :
                                                  <User className="w-4 h-4 text-primary-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-white font-medium text-sm truncate">{op.name}</p>
                        <RoleBadge role={op.role} />
                      </div>
                      <p className="text-white/40 text-xs truncate">{op.email}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {opWH.length > 0 && (
                          <span className="text-white/30 text-xs flex items-center gap-1">
                            <Warehouse className="w-3 h-3" />{opWH.join(', ')}
                          </span>
                        )}
                        {!isAdminRole && (
                          <span className="text-white/30 text-xs flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {countActivePerms(op)}/{PERMISSIONS_DEF.length} permisos
                          </span>
                        )}
                        {isAdminRole && (
                          <span className="text-blue-400/60 text-xs flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Todos los permisos
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => toggleActive(op)}
                        className={`p-2 rounded-lg transition-all ${
                          op.is_active ? 'text-primary-400 hover:bg-primary-500/10' : 'text-white/20 hover:bg-white/[0.06]'
                        }`} title={op.is_active ? 'Desactivar' : 'Activar'}>
                        {op.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => toggleExpand(op)}
                        className={`p-2 rounded-lg transition-all ${
                          isExpanded ? 'bg-primary-500/20 text-primary-400' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08]'
                        }`} title="Editar">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* ── Panel de edición ──────────── */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.06] p-4 pt-3">
                      {/* Tabs */}
                      <div className="flex gap-1 mb-4 bg-white/[0.03] rounded-xl p-1">
                        {[
                          { key: 'bodegas',  label: 'Bodegas',  Icon: Warehouse   },
                          { key: 'permisos', label: 'Permisos', Icon: Shield,     hide: isAdminRole },
                          { key: 'rol',      label: 'Rol',      Icon: ShieldAlert },
                        ].filter(t => !t.hide).map(tab => (
                          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                              activeTab === tab.key ? 'bg-primary-500/20 text-primary-400' : 'text-white/40 hover:text-white/60'
                            }`}>
                            <tab.Icon className="w-3.5 h-3.5" />{tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Tab: Bodegas */}
                      {activeTab === 'bodegas' && (
                        <div className="space-y-2">
                          {warehouses.length === 0
                            ? <p className="text-white/30 text-sm text-center py-4">No hay bodegas disponibles</p>
                            : warehouses.map(wh => (
                              <label key={wh.id}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-all">
                                <input type="checkbox" className="w-4 h-4 accent-primary-500 rounded"
                                  checked={editWH.includes(wh.id)}
                                  onChange={() => setEditWH(prev =>
                                    prev.includes(wh.id) ? prev.filter(id => id !== wh.id) : [...prev, wh.id]
                                  )} />
                                <span className="text-white text-sm flex-1">{wh.name}</span>
                                <span className="text-white/30 text-xs font-mono">{wh.code}</span>
                              </label>
                            ))
                          }
                          <SaveBtn onClick={() => saveBodegas(op)} loading={isSavingEdit} label="Guardar bodegas" />
                        </div>
                      )}

                      {/* Tab: Permisos */}
                      {activeTab === 'permisos' && (
                        <div>
                          <p className="text-white/30 text-xs mb-3">
                            Configura qué acciones puede realizar este operador.
                          </p>
                          <div className="space-y-2">
                            {PERMISSIONS_DEF.map(p => (
                              <PermissionToggle key={p.key} {...p}
                                checked={!!editPerms[p.key]}
                                onChange={(k, v) => setEditPerms(prev => ({ ...prev, [k]: v }))}
                                disabled={false} />
                            ))}
                          </div>
                          <SaveBtn onClick={() => savePermisos(op)} loading={isSavingEdit} label="Guardar permisos" />
                        </div>
                      )}

                      {/* Tab: Rol */}
                      {activeTab === 'rol' && (
                        <div className="space-y-2">
                          <p className="text-white/30 text-xs mb-3">
                            Admins tienen todos los permisos. Solo superadmin puede asignar rol superadmin.
                          </p>
                          {['operator', 'admin', ...(isSuperAdmin ? ['superadmin'] : [])].map(r => (
                            <label key={r}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                editRole === r ? 'bg-primary-500/10 border-primary-500/30' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                              }`}>
                              <input type="radio" name={`role-${op.id}`} value={r}
                                checked={editRole === r} onChange={() => setEditRole(r)}
                                className="accent-primary-500" />
                              <div className="flex-1">
                                <RoleBadge role={r} />
                                <p className="text-white/30 text-xs mt-1">
                                  {r === 'operator'   && 'Acceso según permisos configurados'}
                                  {r === 'admin'      && 'Gestión completa de la empresa'}
                                  {r === 'superadmin' && 'Acceso a todas las empresas'}
                                </p>
                              </div>
                            </label>
                          ))}
                          <SaveBtn onClick={() => saveRol(op)} loading={isSavingEdit} label="Cambiar rol" />
                        </div>
                      )}
                    </div>
                  )}
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
