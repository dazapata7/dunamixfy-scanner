// =====================================================
// PRODUCTION ORDERS — Lista + crear órdenes de fabricación
// =====================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { productionService, bomService, productsService } from '../../services/wmsService';
import { warehousesService } from '../../services/wmsService';
import { useStore } from '../../store/useStore';
import {
  Plus, Factory, ChevronRight, Clock, CheckCircle,
  PlayCircle, PauseCircle, XCircle, X, AlertTriangle,
  Package, Beaker, ArrowLeft, RefreshCw
} from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────
const STATUS = {
  draft:       { label: 'Borrador',    color: 'bg-white/[0.05] border-white/[0.10] text-white/50',           icon: Clock       },
  in_progress: { label: 'En Proceso',  color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',             icon: PlayCircle  },
  paused:      { label: 'Pausada',     color: 'bg-amber-500/10 border-amber-500/20 text-amber-400',           icon: PauseCircle },
  completed:   { label: 'Completada',  color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',     icon: CheckCircle },
  cancelled:   { label: 'Cancelada',   color: 'bg-red-500/10 border-red-500/20 text-red-400/70',             icon: XCircle     },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.draft;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${s.color}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
};

// ── Modal crear orden ─────────────────────────────────────────────────────
function CreateOrderModal({ warehouses, onCreated, onClose }) {
  const operator    = useStore(s => s.operator);
  const operatorId  = useStore(s => s.operatorId);
  const selectedWH  = useStore(s => s.selectedWarehouse);

  const [form, setForm] = useState({
    productId:   '',
    warehouseId: selectedWH?.id || '',
    qtyPlanned:  1,
    plannedDate: '',
    notes:       '',
  });
  const [products, setProducts]     = useState([]);
  const [bom, setBom]               = useState(null);
  const [materials, setMaterials]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    productsService.getAll().then(all =>
      setProducts(all.filter(p => ['finished_good', 'semi_finished', 'combo'].includes(p.type)))
    ).catch(() => {});
  }, []);

  async function handleProductChange(productId) {
    setForm(f => ({ ...f, productId }));
    setBom(null);
    setMaterials([]);
    if (!productId) return;
    setLoading(true);
    try {
      const b = await bomService.getByProduct(productId);
      setBom(b);
      if (b && form.qtyPlanned > 0) {
        const mats = await bomService.calculateMaterials(productId, form.qtyPlanned);
        setMaterials(mats);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleQtyChange(qty) {
    setForm(f => ({ ...f, qtyPlanned: qty }));
    if (form.productId && qty > 0) {
      try {
        const mats = await bomService.calculateMaterials(form.productId, qty);
        setMaterials(mats);
      } catch { /* ignore */ }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productId)   return toast.error('Selecciona el producto a fabricar');
    if (!form.warehouseId) return toast.error('Selecciona la bodega');
    if (form.qtyPlanned < 1) return toast.error('La cantidad debe ser mayor a 0');
    setSaving(true);
    try {
      await productionService.create({
        productId:   form.productId,
        bomId:       bom?.id || null,
        warehouseId: form.warehouseId,
        operatorId:  operatorId || null,
        qtyPlanned:  parseFloat(form.qtyPlanned),
        plannedDate: form.plannedDate || null,
        notes:       form.notes.trim() || null,
      });
      toast.success('Orden de producción creada');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al crear orden');
    } finally {
      setSaving(false);
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <h2 className="text-white font-bold">Nueva Orden de Producción</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Producto */}
          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest mb-1.5 block">Producto a fabricar *</label>
            <select value={form.productId} onChange={e => handleProductChange(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50">
              <option value="">Selecciona producto...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
            {form.productId && !bom && !loading && (
              <p className="text-amber-400/70 text-xs mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Sin BOM definido — no se gestionarán insumos automáticamente
              </p>
            )}
          </div>

          {/* Qty + Bodega */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-widest mb-1.5 block">Cantidad a producir *</label>
              <input type="number" min="1" step="1" value={form.qtyPlanned}
                onChange={e => handleQtyChange(parseFloat(e.target.value) || 1)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
            </div>
            <div>
              <label className="text-white/40 text-xs uppercase tracking-widest mb-1.5 block">Bodega *</label>
              <select value={form.warehouseId} onChange={e => set('warehouseId', e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50">
                <option value="">Selecciona...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha planificada */}
          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest mb-1.5 block">Fecha planificada</label>
            <input type="date" value={form.plannedDate} onChange={e => set('plannedDate', e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500/50" />
          </div>

          {/* Materiales requeridos (preview del BOM) */}
          {loading && (
            <div className="flex items-center gap-2 text-white/40 text-sm py-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-primary-400 rounded-full animate-spin" />
              Calculando materiales...
            </div>
          )}
          {materials.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Beaker className="w-4 h-4 text-amber-400" />
                <span className="text-white/70 text-sm font-semibold">Materiales necesarios ({form.qtyPlanned} uds)</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {materials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-white/80 text-sm">{m.component_name}</p>
                      <p className="text-white/35 text-xs font-mono">{m.component_sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-sm font-semibold">{m.qty_required}</p>
                      <p className={`text-xs font-semibold ${m.has_sufficient_stock ? 'text-emerald-400/70' : 'text-red-400'}`}>
                        {m.has_sufficient_stock ? `✓ ${m.qty_available} disp.` : `✗ solo ${m.qty_available}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest mb-1.5 block">Notas</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="Observaciones opcionales..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary-500/50 resize-none" />
          </div>
        </form>

        <div className="flex gap-2 p-5 border-t border-white/[0.06] flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear Orden'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function ProductionOrders() {
  const navigate          = useNavigate();
  const selectedWarehouse = useStore(s => s.selectedWarehouse);

  const [orders, setOrders]       = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ords, whs] = await Promise.all([
        productionService.getAll(selectedWarehouse?.id || null),
        warehousesService.getAll(),
      ]);
      setOrders(ords);
      setWarehouses(whs);
    } catch { toast.error('Error al cargar órdenes'); }
    finally { setLoading(false); }
  }, [selectedWarehouse?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o =>
    statusFilter === 'all' ? true : o.status === statusFilter
  );

  const stats = {
    draft:       orders.filter(o => o.status === 'draft').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed:   orders.filter(o => o.status === 'completed').length,
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* Header móvil */}
        <div className="lg:hidden flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h1 className="text-lg font-bold text-white">Producción</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'draft',       label: 'Borradores',    color: 'text-white/50' },
            { key: 'in_progress', label: 'En Proceso',    color: 'text-blue-400' },
            { key: 'completed',   label: 'Completadas',   color: 'text-emerald-400' },
          ].map(s => (
            <button key={s.key}
              onClick={() => setStatusFilter(prev => prev === s.key ? 'all' : s.key)}
              className={`bg-white/[0.03] border rounded-2xl p-4 text-left transition-all ${
                statusFilter === s.key ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.07] hover:bg-white/[0.05]'
              }`}>
              <p className={`text-2xl font-black ${s.color}`}>{stats[s.key]}</p>
              <p className="text-white/35 text-xs mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(STATUS).map(([key, meta]) => (
              <button key={key}
                onClick={() => setStatusFilter(p => p === key ? 'all' : key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === key
                    ? 'bg-white/10 text-white'
                    : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
                }`}>
                {meta.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all text-sm font-semibold">
              <Plus className="w-4 h-4" /> Nueva Orden
            </button>
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
            <Factory className="w-12 h-12 text-white/10" />
            <p className="text-white/30 text-sm">No hay órdenes de producción</p>
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all text-sm font-semibold">
              Crear primera orden
            </button>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Desktop table */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-black/20">
                    {['Orden','Producto','Bodega','Planificado','Producido','Estado','Fecha',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filtered.map(order => (
                    <tr key={order.id}
                      onClick={() => navigate(`/wms/production/${order.id}`)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-white font-mono text-sm font-semibold">{order.order_number}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white/80 text-sm">{order.product?.name || '—'}</p>
                        <p className="text-white/35 text-xs font-mono">{order.product?.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-sm">{order.warehouse?.name || '—'}</td>
                      <td className="px-4 py-3 text-white/70 text-sm font-semibold">{order.qty_planned}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${order.qty_produced > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
                          {order.qty_produced || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 text-white/35 text-xs">
                        {order.planned_date
                          ? format(new Date(order.planned_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-white/[0.04]">
              {filtered.map(order => (
                <div key={order.id}
                  onClick={() => navigate(`/wms/production/${order.id}`)}
                  className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white font-mono text-sm font-bold">{order.order_number}</p>
                      <p className="text-white/60 text-sm">{order.product?.name}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span>Plan: <strong className="text-white/60">{order.qty_planned}</strong></span>
                    <span>Prod: <strong className="text-emerald-400/70">{order.qty_produced || 0}</strong></span>
                    <span>{order.warehouse?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateOrderModal
          warehouses={warehouses}
          onCreated={load}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
