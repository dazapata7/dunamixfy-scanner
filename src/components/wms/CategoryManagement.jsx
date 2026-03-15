// =====================================================
// CATEGORY MANAGEMENT — Árbol de categorías de productos
// =====================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { categoriesService } from '../../services/wmsService';
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  FolderOpen, Folder, X, Check, ArrowLeft
} from 'lucide-react';

const COLORS = [
  '#0afdbd','#3b82f6','#f59e0b','#8b5cf6',
  '#ef4444','#10b981','#f97316','#06b6d4',
];

const ICONS = ['📦','🏭','✅','🔧','🏷️','🫙','📫','🧪','🛒','🔩','🎁','🧴','🧼','💊','🍃'];

// ── Modal para crear/editar ───────────────────────────────────────────────
function CategoryModal({ category, categories, onSave, onClose }) {
  const isEdit = !!category?.id;
  const [form, setForm] = useState({
    name:       category?.name       || '',
    parent_id:  category?.parent_id  || '',
    icon:       category?.icon       || '📦',
    color:      category?.color      || '#0afdbd',
    sort_order: category?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      const payload = {
        ...form,
        parent_id: form.parent_id || null,
        sort_order: parseInt(form.sort_order) || 0,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // Filtrar para no poner una cat como su propio padre ni descendientes
  const parentOptions = categories.filter(c => c.id !== category?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-bold text-base">
            {isEdit ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Nombre</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej: Insumos de Fabricación"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>

          {/* Categoría padre */}
          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Categoría padre (opcional)</label>
            <select
              value={form.parent_id}
              onChange={e => set('parent_id', e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Sin categoría padre (raíz)</option>
              {parentOptions.filter(c => !c.parent_id).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Icono */}
          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Icono</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ico => (
                <button
                  key={ico} type="button"
                  onClick={() => set('icon', ico)}
                  className={`w-9 h-9 text-lg rounded-lg flex items-center justify-center transition-all ${
                    form.icon === ico
                      ? 'bg-primary-500/20 border border-primary-500/50 scale-110'
                      : 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]'
                  }`}
                >
                  {ico}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(col => (
                <button
                  key={col} type="button"
                  onClick={() => set('color', col)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    form.color === col ? 'ring-2 ring-white/60 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ background: col }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <span className="text-base">{form.icon}</span>
            <span className="text-sm font-semibold" style={{ color: form.color }}>
              {form.name || 'Nombre de categoría'}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary-500/15 text-primary-400 border border-primary-500/25 hover:bg-primary-500/25 transition-all disabled:opacity-50">
              {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Nodo del árbol ────────────────────────────────────────────────────────
function CategoryNode({ node, depth = 0, onEdit, onDelete, onAddChild }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-white/[0.04] transition-all group"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {/* Chevron / espacio */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-5 h-5 flex items-center justify-center text-white/30 flex-shrink-0"
        >
          {hasChildren
            ? (expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
            : <span className="w-3.5 h-3.5" />
          }
        </button>

        {/* Icono carpeta + emoji */}
        <span className="text-base flex-shrink-0">{node.icon || '📁'}</span>

        {/* Nombre */}
        <span className="flex-1 text-sm font-medium" style={{ color: node.color || 'rgba(255,255,255,0.8)' }}>
          {node.name}
        </span>

        {/* Acciones */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAddChild(node)}
            className="p-1.5 rounded-lg text-white/30 hover:text-primary-400 hover:bg-primary-500/10 transition-all" title="Agregar subcategoría">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(node)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all" title="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(node)}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <CategoryNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function CategoryManagement() {
  const navigate = useNavigate();
  const [tree, setTree]       = useState([]);
  const [flat, setFlat]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | { category, prefillParent }

  const load = useCallback(async () => {
    try {
      const [treeData, flatData] = await Promise.all([
        categoriesService.getTree(),
        categoriesService.getAll(),
      ]);
      setTree(treeData);
      setFlat(flatData);
    } catch (err) {
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    if (modal.category?.id) {
      await categoriesService.update(modal.category.id, data);
      toast.success('Categoría actualizada');
    } else {
      await categoriesService.create(data);
      toast.success('Categoría creada');
    }
    await load();
  }

  async function handleDelete(node) {
    if (!confirm(`¿Eliminar categoría "${node.name}"?\nLos productos mantendrán su referencia pero sin categoría padre.`)) return;
    try {
      await categoriesService.delete(node.id);
      toast.success('Categoría eliminada');
      await load();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar');
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="lg:hidden flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h1 className="text-lg font-bold text-white">Categorías</h1>
        </div>

        {/* Card principal */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="text-white font-bold">Categorías de Productos</h2>
              <p className="text-white/40 text-sm mt-0.5">{flat.length} categorías activas</p>
            </div>
            <button
              onClick={() => setModal({ category: null })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Nueva categoría
            </button>
          </div>

          <div className="p-3">
            {tree.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay categorías. Crea la primera.</p>
              </div>
            ) : (
              tree.map(node => (
                <CategoryNode
                  key={node.id}
                  node={node}
                  onEdit={cat => setModal({ category: cat })}
                  onDelete={handleDelete}
                  onAddChild={parent => setModal({ category: { parent_id: parent.id } })}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {modal !== null && (
        <CategoryModal
          category={modal.category}
          categories={flat}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
