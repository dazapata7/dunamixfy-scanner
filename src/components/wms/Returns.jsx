// =====================================================
// RETURNS - Módulo de Devoluciones (Coordinadora)
// =====================================================
// Flujo: ingresar guía retorno → consulta Coordinadora
// → encuentra guía original → muestra productos del
// despacho → confirma → repone stock (IN movements)
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { returnsService } from '../../services/returnsService';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
  RotateCcw, Search, Package, CheckCircle,
  AlertTriangle, ChevronRight, ExternalLink, RefreshCw,
  ArrowUpCircle, Plus, Minus
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────
const STATUS_MAP = {
  draft:     { label: 'Borrador',   color: 'bg-yellow-500/15 text-yellow-400  border-yellow-500/20' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelada',  color: 'bg-red-500/15     text-red-400    border-red-500/20'    },
};

function StatusBadge({ status }) {
  const { label, color } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {label}
    </span>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

// ── Vista: Nueva Devolución ───────────────────────────
function NewReturn({ onCreated }) {
  const warehouseId = useStore(s => s.selectedWarehouse?.id);
  const operatorId  = useStore(s => s.operatorId);

  const [step, setStep]   = useState('input');   // input | looking | found | manual | confirm
  const [guide, setGuide] = useState('');
  const [loading, setLoading] = useState(false);

  // Resultado del lookup
  const [coordinadoraData, setCoordinadoraData] = useState(null);
  const [dispatch, setDispatch]                 = useState(null);

  // Entrada manual de guía original cuando el scraping falla
  const [manualGuide, setManualGuide]           = useState('');
  const [manualLoading, setManualLoading]       = useState(false);

  // Ítems a devolver (editables)
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  const handleLookup = useCallback(async () => {
    const trimmed = guide.trim();
    if (!trimmed) return;

    setLoading(true);
    setStep('looking');
    try {
      const result = await returnsService.resolve(trimmed);
      setCoordinadoraData(result.coordinadora);
      setDispatch(result.dispatch);

      if (result.coordinadora?.associatedGuide) {
        // Coordinadora encontró la guía original → mostrar pantalla found
        if (result.dispatch?.dispatch_items?.length > 0) {
          // Despacho en BD → pre-cargar ítems
          setItems(result.dispatch.dispatch_items.map(di => ({
            product_id: di.product_id,
            name:       di.products?.name ?? 'Producto',
            sku:        di.products?.sku  ?? '-',
            qty:        di.qty,
            condition:  'good',
          })));
        }
        // Mostrar found aunque no haya dispatch en BD
        setStep('found');
      } else {
        // Coordinadora no encontró guía asociada → ingreso manual
        setStep('manual');
      }
    } catch (err) {
      toast.error(err.message || 'Error al consultar Coordinadora');
      setStep('input');
    } finally {
      setLoading(false);
    }
  }, [guide]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLookup();
  };

  const adjustQty = (idx, delta) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const newQty = Math.max(0, it.qty + delta);
      return { ...it, qty: newQty };
    }));
  };

  const setCondition = (idx, condition) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, condition } : it));
  };

  const handleConfirm = async () => {
    if (!warehouseId) { toast.error('Selecciona una bodega primero'); return; }

    const validItems = items.filter(i => i.qty > 0);
    if (validItems.length === 0) { toast.error('Agrega al menos un producto con cantidad > 0'); return; }

    setLoading(true);
    try {
      const carrierId = dispatch?.shipment_record?.carriers?.id ?? null;

      const ret = await returnsService.create({
        returnGuideCode:    guide.trim(),
        originalGuideCode:  coordinadoraData?.associatedGuide ?? null,
        originalDispatchId: dispatch?.id ?? null,
        warehouseId,
        operatorId:         operatorId ?? null,
        carrierId,
        notes: notes || null,
      }, validItems.map(i => ({
        product_id: i.product_id,
        qty:        i.qty,
        condition:  i.condition,
      })));

      // Confirmar de inmediato
      await returnsService.confirm(ret.id, operatorId);

      toast.success(`✅ Devolución ${ret.return_number} confirmada — stock repuesto`);
      onCreated?.();
      setStep('input');
      setGuide('');
      setItems([]);
      setCoordinadoraData(null);
      setDispatch(null);
    } catch (err) {
      toast.error(err.message || 'Error al confirmar devolución');
    } finally {
      setLoading(false);
    }
  };

  // ── Render: paso de búsqueda ──────────────────────
  const renderInput = () => (
    <Card className="p-6">
      <h2 className="text-white/80 font-semibold text-sm mb-4 flex items-center gap-2">
        <Search className="w-4 h-4 text-primary-400" />
        Número de guía de devolución
      </h2>
      <p className="text-white/40 text-xs mb-4 leading-relaxed">
        Ingresa o escanea el número de guía de devolución. Consultaremos el tracking de
        Coordinadora para encontrar la guía original y los productos del pedido.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={guide}
          onChange={e => setGuide(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: 39725853690"
          className="flex-1 bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 font-mono"
          autoFocus
        />
        <button
          onClick={handleLookup}
          disabled={!guide.trim() || loading}
          className="px-5 py-3 rounded-xl bg-primary-500 text-dark-950 font-bold text-sm hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          Buscar
        </button>
      </div>

      {/* Hint Coordinadora */}
      <a
        href={`https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guide.trim() || '0'}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-primary-400/70 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Ver tracking en Coordinadora.com
      </a>
    </Card>
  );

  const renderLooking = () => (
    <Card className="p-8 flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <div className="text-center">
        <p className="text-white/70 font-semibold text-sm">Consultando Coordinadora...</p>
        <p className="text-white/35 text-xs mt-1">Buscando guía asociada: <span className="font-mono text-white/50">{guide}</span></p>
      </div>
    </Card>
  );

  const renderFound = () => (
    <div className="space-y-4">
      {/* Info de guías */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">Guía retorno:</span>
              <span className="font-mono text-white/80 text-sm">{guide}</span>
            </div>
            {coordinadoraData?.associatedGuide && (
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-white/40 text-xs">Guía original:</span>
                <span className="font-mono text-primary-400 font-bold text-sm">{coordinadoraData.associatedGuide}</span>
              </div>
            )}
            {coordinadoraData?.guideStatus && (
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Estado:</span>
                <span className="text-white/60 text-xs">{coordinadoraData.guideStatus}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">Encontrada</span>
          </div>
        </div>

        {dispatch && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-3">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Despacho original</p>
              <p className="text-white/70 font-mono text-xs mt-0.5">{dispatch.dispatch_number}</p>
            </div>
            {dispatch.shipment_record?.carriers && (
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">Transportadora</p>
                <p className="text-white/70 text-xs mt-0.5">{dispatch.shipment_record.carriers.name}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Tabla de productos */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-white/70 font-semibold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary-400" />
            Productos a devolver
          </h3>
          <span className="text-white/35 text-xs">{items.filter(i=>i.qty>0).length} / {items.length} productos</span>
        </div>
        {items.length === 0 && (
          <div className="px-4 py-5 text-center">
            <p className="text-white/40 text-xs">
              El despacho original no está en la base de datos de esta bodega.<br/>
              La guía original es <span className="font-mono text-primary-400">{coordinadoraData?.associatedGuide}</span> — puedes confirmar la devolución sin productos asociados o añadirlos manualmente más adelante.
            </p>
          </div>
        )}
        <div className="divide-y divide-white/[0.04]">
          {items.map((item, idx) => (
            <div key={item.product_id} className={`px-4 py-3 flex items-center gap-3 ${item.qty === 0 ? 'opacity-40' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium truncate">{item.name}</p>
                <p className="text-white/35 text-xs font-mono">{item.sku}</p>
              </div>
              {/* Condición */}
              <div className="flex gap-1">
                <button
                  onClick={() => setCondition(idx, 'good')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                    item.condition === 'good'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/35 hover:text-white/60'
                  }`}
                >
                  Buen estado
                </button>
                <button
                  onClick={() => setCondition(idx, 'damaged')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                    item.condition === 'damaged'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/35 hover:text-white/60'
                  }`}
                >
                  Dañado
                </button>
              </div>
              {/* Qty stepper */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => adjustQty(idx, -1)}
                  className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-all"
                >
                  <Minus className="w-3 h-3 text-white/50" />
                </button>
                <span className="w-8 text-center text-white/80 font-mono font-bold text-sm">{item.qty}</span>
                <button
                  onClick={() => adjustQty(idx, +1)}
                  className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-all"
                >
                  <Plus className="w-3 h-3 text-white/50" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Notas */}
      <Card className="p-4">
        <label className="block text-white/45 text-xs mb-2">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Motivo de la devolución, observaciones..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-sm resize-none focus:outline-none focus:border-primary-500/40"
        />
      </Card>

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          onClick={() => { setStep('input'); setGuide(''); setItems([]); setCoordinadoraData(null); setDispatch(null); }}
          className="px-4 py-2.5 rounded-xl border border-white/[0.10] text-white/45 hover:text-white/70 hover:bg-white/[0.05] text-sm font-medium transition-all flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Nueva búsqueda
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || items.filter(i=>i.qty>0).length === 0}
          className="flex-1 py-2.5 rounded-xl bg-primary-500 text-dark-950 font-bold text-sm hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
          Confirmar Devolución — Reponer Stock
        </button>
      </div>
    </div>
  );

  const handleManualLookup = async () => {
    const trimmed = manualGuide.trim();
    if (!trimmed) return;
    setManualLoading(true);
    try {
      const { data: d, error } = await supabase
        .from('dispatches')
        .select('*, dispatch_items(*, products(*)), shipment_record:shipment_records(*, carriers(*))')
        .eq('guide_code', trimmed)
        .maybeSingle();

      if (error) throw error;

      if (d?.dispatch_items?.length > 0) {
        setDispatch(d);
        setCoordinadoraData(prev => ({ ...prev, associatedGuide: trimmed }));
        setItems(d.dispatch_items.map(di => ({
          product_id: di.product_id,
          name:       di.products?.name ?? 'Producto',
          sku:        di.products?.sku  ?? '-',
          qty:        di.qty,
          condition:  'good',
        })));
        setStep('found');
      } else {
        toast.error(`No se encontró despacho con guía ${trimmed} en la base de datos`);
      }
    } catch (err) {
      toast.error(err.message || 'Error al buscar despacho');
    } finally {
      setManualLoading(false);
    }
  };

  const renderManual = () => (
    <div className="space-y-4">
      {/* Aviso */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-semibold text-sm">Rastreo automático no disponible</p>
            <p className="text-white/45 text-xs mt-1 leading-relaxed">
              No se pudo extraer la guía asociada automáticamente (Coordinadora carga su tracking
              con JavaScript). Consulta el sitio directamente y copia el número de la
              <strong className="text-white/60"> Guía Asociada</strong>.
            </p>
          </div>
        </div>

        {/* Link directo al tracking */}
        <a
          href={`https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guide.trim()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-primary-400/80 hover:text-primary-400 hover:bg-white/[0.08] transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ver tracking de guía {guide.trim()} en Coordinadora.com
        </a>
      </Card>

      {/* Ingreso manual de guía original */}
      <Card className="p-4 space-y-3">
        <p className="text-white/60 text-sm font-semibold">Ingresa la guía original manualmente</p>
        <p className="text-white/35 text-xs">
          En el historial de Coordinadora busca la línea que dice <span className="font-mono bg-white/[0.06] px-1 rounded">Guía Asociada: XXXXXXXXXX</span> y copia ese número.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualGuide}
            onChange={e => setManualGuide(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
            placeholder="Ej: 56813981708"
            className="flex-1 bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 font-mono"
            autoFocus
          />
          <button
            onClick={handleManualLookup}
            disabled={!manualGuide.trim() || manualLoading}
            className="px-4 py-2.5 rounded-xl bg-primary-500 text-dark-950 font-bold text-sm hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {manualLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
      </Card>

      <button
        onClick={() => { setStep('input'); setGuide(''); setManualGuide(''); }}
        className="w-full py-2.5 rounded-xl border border-white/[0.10] text-white/40 hover:text-white/65 hover:bg-white/[0.04] text-sm font-medium transition-all"
      >
        Intentar con otra guía de devolución
      </button>
    </div>
  );

  return (
    <div>
      {step === 'input'   && renderInput()}
      {step === 'looking' && renderLooking()}
      {step === 'found'   && renderFound()}
      {step === 'manual'  && renderManual()}
    </div>
  );
}

// ── Vista: Historial de Devoluciones ─────────────────
function ReturnsList({ refreshKey }) {
  const warehouseId = useStore(s => s.selectedWarehouse?.id);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!warehouseId) return;
    setLoading(true);
    returnsService.getAll(warehouseId)
      .then(setReturns)
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [warehouseId, refreshKey]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (returns.length === 0) return (
    <Card className="p-10 flex flex-col items-center gap-3 text-center">
      <RotateCcw className="w-10 h-10 text-white/15" />
      <p className="text-white/40 text-sm">No hay devoluciones registradas</p>
    </Card>
  );

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-white/70 font-semibold text-sm">Historial de Devoluciones</h3>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {returns.map(ret => {
          const itemCount = ret.return_items?.[0]?.count ?? 0;
          return (
            <div key={ret.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white/80 font-mono font-semibold text-sm">{ret.return_number}</p>
                  <StatusBadge status={ret.status} />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/35 text-xs font-mono">{ret.return_guide_code}</span>
                  {ret.original_guide_code && (
                    <>
                      <ChevronRight className="w-3 h-3 text-white/20" />
                      <span className="text-primary-400/60 text-xs font-mono">{ret.original_guide_code}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/50 text-xs">{itemCount} producto{itemCount !== 1 ? 's' : ''}</p>
                <p className="text-white/25 text-[10px] mt-0.5">
                  {new Date(ret.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────
export default function Returns() {
  const warehouseId = useStore(s => s.selectedWarehouse?.id);
  const [tab, setTab]           = useState('new');       // new | history
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = () => {
    setRefreshKey(k => k + 1);
    setTab('history');
  };

  if (!warehouseId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card className="p-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400/60" />
          <p className="text-white/60 font-semibold text-sm">Selecciona una bodega</p>
          <p className="text-white/35 text-xs">Necesitas tener una bodega activa para gestionar devoluciones.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-white font-bold text-xl flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-primary-400" />
          Devoluciones
        </h1>
        <p className="text-white/40 text-sm mt-1">Coordinadora — Rastreo automático de guía asociada</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
        {[
          { key: 'new',     label: 'Nueva Devolución' },
          { key: 'history', label: 'Historial' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'text-white/40 hover:text-white/65'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'new'     && <NewReturn onCreated={handleCreated} />}
      {tab === 'history' && <ReturnsList refreshKey={refreshKey} />}
    </div>
  );
}
