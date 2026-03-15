// =====================================================
// PRODUCTION ORDER DETAIL — Ver, iniciar y completar OP
// =====================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { productionService } from '../../services/wmsService';
import { useStore } from '../../store/useStore';
import {
  ArrowLeft, PlayCircle, PauseCircle, CheckCircle,
  XCircle, AlertTriangle, Package, Beaker, ChevronRight,
  X, Loader2, Check
} from 'lucide-react';

const STATUS_CONFIG = {
  draft:       { label: 'Borrador',   bg: 'bg-white/[0.05]',       text: 'text-white/50',    border: 'border-white/10'       },
  in_progress: { label: 'En Proceso', bg: 'bg-blue-500/10',        text: 'text-blue-400',    border: 'border-blue-500/20'    },
  paused:      { label: 'Pausada',    bg: 'bg-amber-500/10',       text: 'text-amber-400',   border: 'border-amber-500/20'   },
  completed:   { label: 'Completada', bg: 'bg-emerald-500/10',     text: 'text-emerald-400', border: 'border-emerald-500/20' },
  cancelled:   { label: 'Cancelada',  bg: 'bg-red-500/[0.08]',     text: 'text-red-400/70',  border: 'border-red-500/15'     },
};

// ── Modal: Completar producción ───────────────────────────────────────────
function CompleteModal({ order, onCompleted, onClose }) {
  const operatorId = useStore(s => s.operatorId);
  const [qty, setQty]       = useState(order.qty_planned - order.qty_produced);
  const [saving, setSaving] = useState(false);

  const stockOK = (order.materials || []).filter(m => {
    const avail = (m.component?.stock_qty || 0);
    return avail < m.qty_required;
  });

  async function handleComplete() {
    if (qty <= 0) return toast.error('La cantidad debe ser mayor a 0');
    setSaving(true);
    try {
      const result = await productionService.complete(order.id, qty, operatorId || null);
      if (result?.success) {
        toast.success(result.message || 'Producción completada');
        onCompleted();
        onClose();
      } else {
        toast.error(result?.message || 'Error al completar');
      }
    } catch (err) {
      toast.error(err.message || 'Error al completar producción');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Completar Producción
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Fabricando</p>
            <p className="text-white font-bold">{order.product?.name}</p>
            <p className="text-white/40 text-sm mt-0.5">Plan: {order.qty_planned} · Ya producido: {order.qty_produced || 0}</p>
          </div>

          {stockOK.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 text-sm font-semibold">Advertencia de stock</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Algunos insumos pueden tener stock insuficiente. Revisa antes de continuar.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest mb-1.5 block">
              Cantidad producida en esta corrida
            </label>
            <input
              type="number" min="0.01" step="1"
              value={qty}
              onChange={e => setQty(parseFloat(e.target.value) || 0)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-white/30 text-xs mt-1 text-center">
              Se descontarán los insumos del BOM y se sumará {qty} ud(s) al inventario de {order.product?.name}
            </p>
          </div>

          {/* Resumen de insumos a consumir */}
          {(order.materials || []).length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.05]">
                <p className="text-white/50 text-xs uppercase tracking-widest">Insumos a consumir</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {order.materials.map((m, i) => {
                  const toConsume = Math.round(m.qty_required * (qty / order.qty_planned) * 10000) / 10000;
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-2">
                      <p className="text-white/70 text-sm">{m.component?.name || m.component_product_id}</p>
                      <span className="text-white/50 text-sm font-mono">-{toConsume}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
            Cancelar
          </button>
          <button onClick={handleComplete} disabled={saving || qty <= 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : <><Check className="w-4 h-4" /> Confirmar producción</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function ProductionOrderDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const operatorId = useStore(s => s.operatorId);

  const [order, setOrder]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await productionService.getById(id);
      setOrder(data);
    } catch { toast.error('Error al cargar la orden'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleStart() {
    if (!confirm('¿Iniciar esta orden de producción?')) return;
    setActing(true);
    try {
      const result = await productionService.start(order.id);
      if (result?.success) {
        if (result.warnings?.length > 0) {
          result.warnings.forEach(w => toast(w, { icon: '⚠️', duration: 5000 }));
        }
        toast.success('Orden iniciada');
        await load();
      } else {
        toast.error(result?.message || 'Error al iniciar');
      }
    } catch (err) {
      toast.error(err.message || 'Error al iniciar');
    } finally {
      setActing(false);
    }
  }

  async function handlePause() {
    setActing(true);
    try {
      await productionService.pause(order.id);
      toast.success('Orden pausada');
      await load();
    } catch (err) {
      toast.error(err.message || 'Error');
    } finally { setActing(false); }
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar esta orden? Esta acción no se puede deshacer.')) return;
    setActing(true);
    try {
      await productionService.cancel(order.id);
      toast.success('Orden cancelada');
      navigate(-1);
    } catch (err) {
      toast.error(err.message || 'Error');
    } finally { setActing(false); }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta orden?')) return;
    try {
      await productionService.delete(order.id);
      toast.success('Orden eliminada');
      navigate(-1);
    } catch (err) {
      toast.error(err.message || 'Solo se pueden eliminar órdenes en borrador o canceladas');
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center text-white/40">
      Orden no encontrada
    </div>
  );

  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
  const progress = order.qty_planned > 0 ? Math.min((order.qty_produced / order.qty_planned) * 100, 100) : 0;

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Back */}
        <button onClick={() => navigate(-1)}
          className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Header card */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-white/40 text-sm">Orden de Producción</p>
              <h1 className="text-white font-black text-2xl font-mono mt-0.5">{order.order_number}</h1>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold ${sc.bg} ${sc.text} ${sc.border}`}>
              {sc.label}
            </span>
          </div>

          {/* Producto */}
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-xl p-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white font-semibold">{order.product?.name}</p>
              <p className="text-white/40 text-sm font-mono">{order.product?.sku} · {order.warehouse?.name}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Progreso de producción</span>
              <span className="text-white font-bold">{order.qty_produced || 0} / {order.qty_planned}</span>
            </div>
            <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-white/30 text-xs text-right">{Math.round(progress)}% completado</p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
            <div>
              <p className="text-white/30 text-xs uppercase tracking-widest mb-0.5">Operador</p>
              <p className="text-white/70">{order.operator?.name || '—'}</p>
            </div>
            <div>
              <p className="text-white/30 text-xs uppercase tracking-widest mb-0.5">Fecha planif.</p>
              <p className="text-white/70">
                {order.planned_date
                  ? format(new Date(order.planned_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-white/30 text-xs uppercase tracking-widest mb-0.5">Iniciada</p>
              <p className="text-white/70">
                {order.started_at
                  ? format(new Date(order.started_at), 'dd MMM HH:mm', { locale: es })
                  : '—'}
              </p>
            </div>
          </div>

          {order.notes && (
            <p className="mt-4 text-white/40 text-sm bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
              {order.notes}
            </p>
          )}
        </div>

        {/* Insumos */}
        {(order.materials || []).length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
              <Beaker className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold">Insumos requeridos</h2>
              <span className="text-white/30 text-sm">({order.materials.length})</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {order.materials.map((m, i) => {
                const ratio = m.qty_required > 0 ? Math.min(m.qty_consumed / m.qty_required, 1) : 0;
                return (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm">{m.component?.name || '—'}</p>
                      <p className="text-white/35 text-xs font-mono">{m.component?.sku}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white/70 text-sm font-semibold">
                        {m.qty_consumed || 0} / {m.qty_required}
                      </p>
                      {order.status === 'completed' || order.status === 'in_progress' ? (
                        <div className="mt-1 w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden ml-auto">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${ratio * 100}%` }} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Acciones */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-white/50 text-xs uppercase tracking-widest mb-4">Acciones</h2>
            <div className="flex flex-wrap gap-2">

              {order.status === 'draft' && (
                <button onClick={handleStart} disabled={acting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all font-semibold text-sm disabled:opacity-50">
                  <PlayCircle className="w-4 h-4" />
                  Iniciar producción
                </button>
              )}

              {order.status === 'in_progress' && (
                <>
                  <button onClick={() => setShowComplete(true)} disabled={acting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all font-semibold text-sm disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" />
                    Registrar producción
                  </button>
                  <button onClick={handlePause} disabled={acting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all font-semibold text-sm disabled:opacity-50">
                    <PauseCircle className="w-4 h-4" />
                    Pausar
                  </button>
                </>
              )}

              {order.status === 'paused' && (
                <button onClick={handleStart} disabled={acting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all font-semibold text-sm disabled:opacity-50">
                  <PlayCircle className="w-4 h-4" />
                  Reanudar
                </button>
              )}

              {(order.status === 'paused' || order.status === 'in_progress') && (
                <>
                  <button onClick={() => setShowComplete(true)} disabled={acting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all font-semibold text-sm disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" />
                    Registrar producción
                  </button>
                </>
              )}

              <button onClick={handleCancel} disabled={acting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/[0.15] text-red-400/70 hover:bg-red-500/[0.12] transition-all font-semibold text-sm disabled:opacity-50">
                <XCircle className="w-4 h-4" />
                Cancelar orden
              </button>
            </div>
          </div>
        )}

        {/* Completada: resumen */}
        {order.status === 'completed' && (
          <div className="bg-emerald-500/[0.07] border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4">
            <CheckCircle className="w-10 h-10 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-400 font-bold">Producción completada</p>
              <p className="text-emerald-400/60 text-sm mt-0.5">
                Se produjeron {order.qty_produced} unidades de {order.product?.name}.
                {order.completed_at && ` · ${format(new Date(order.completed_at), 'dd MMM yyyy HH:mm', { locale: es })}`}
              </p>
            </div>
          </div>
        )}

        {/* Borrador: eliminar */}
        {['draft', 'cancelled'].includes(order.status) && (
          <div className="text-center">
            <button onClick={handleDelete}
              className="text-red-400/50 hover:text-red-400 text-sm transition-colors">
              Eliminar orden
            </button>
          </div>
        )}
      </div>

      {showComplete && (
        <CompleteModal
          order={order}
          onCompleted={load}
          onClose={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
