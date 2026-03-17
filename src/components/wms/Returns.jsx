// =====================================================
// RETURNS - Módulo de Devoluciones (Coordinadora)
// =====================================================
// Flujo: escanear guía retorno → Coordinadora API →
// guía original → BD o Dunamixfy → productos →
// confirmar → reponer stock (IN movements)
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { returnsService } from '../../services/returnsService';
import { remoteScannerService } from '../../services/remoteScannerService';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  RotateCcw, Search, Package, CheckCircle,
  AlertTriangle, ChevronRight, ExternalLink, RefreshCw,
  ArrowUpCircle, Plus, Minus, Camera, Smartphone, X,
  Wifi, WifiOff
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────
const STATUS_MAP = {
  draft:     { label: 'Borrador',   color: 'bg-yellow-500/15 text-yellow-400  border-yellow-500/20' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelada',  color: 'bg-red-500/15     text-red-400    border-red-500/20'    },
};

// Limpia el código escaneado: "39725853690.1" → "39725853690"
function cleanScannedCode(raw) {
  return String(raw).replace(/\.[\d]+$/, '').trim();
}

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

  const [step, setStep]   = useState('input');
  const [guide, setGuide] = useState('');
  const [loading, setLoading] = useState(false);

  const [coordinadoraData, setCoordinadoraData] = useState(null);
  const [dispatch, setDispatch]                 = useState(null);
  const [dunamixfyData, setDunamixfyData]       = useState(null);

  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  // Scanner de cámara
  const CAMERA_ID = 'return-camera-scanner';
  const [cameraOpen, setCameraOpen] = useState(false);
  const html5QrcodeRef = useRef(null);

  // Scanner remoto
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [remoteSession, setRemoteSession] = useState(null);
  const [remoteClientUrl, setRemoteClientUrl] = useState(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const remoteChannelRef = useRef(null);

  // Selector de producto manual
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch]   = useState('');
  const [productResults, setProductResults] = useState([]);

  // ── handleLookup con guía específica ──────────────
  const handleLookupWithGuide = useCallback(async (guideCode) => {
    if (!guideCode) return;
    setGuide(guideCode);
    setLoading(true);
    setStep('looking');
    try {
      const result = await returnsService.resolve(guideCode);
      setCoordinadoraData(result.coordinadora);
      setDispatch(result.dispatch);
      setDunamixfyData(result.dunamixfy ?? null);

      if (result.coordinadora?.associatedGuide) {
        // Pre-cargar ítems según la fuente disponible
        if (result.dispatch?.dispatch_items?.length > 0) {
          setItems(result.dispatch.dispatch_items.map(di => ({
            product_id: di.product_id,
            name:       di.products?.name ?? 'Producto',
            sku:        di.products?.sku  ?? '-',
            qty:        di.qty,
            condition:  'good',
          })));
        } else if (result.dunamixfy?.items?.length > 0) {
          setItems(result.dunamixfy.items
            .filter(i => i.product_id) // Solo los que tenemos en BD
            .map(i => ({
              product_id: i.product_id,
              name:       i.product_name ?? i.name,
              sku:        i.product_sku  ?? i.external_sku,
              qty:        i.qty,
              condition:  'good',
            }))
          );
        }
        setStep('found');
      } else {
        setStep('manual');
      }
    } catch (err) {
      toast.error(err.message || 'Error al consultar Coordinadora');
      setStep('input');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLookup = useCallback(() => {
    const trimmed = guide.trim();
    if (trimmed) handleLookupWithGuide(trimmed);
  }, [guide, handleLookupWithGuide]);

  // ── Cámara ────────────────────────────────────────
  const startCamera = async () => {
    setCameraOpen(true);
    // Esperar a que el DOM monte el div
    await new Promise(r => setTimeout(r, 150));
    const el = document.getElementById(CAMERA_ID);
    if (el) el.innerHTML = '';
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrcodeRef.current = new Html5Qrcode(CAMERA_ID);
      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 30,
          qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(h * 0.5) }),
          rememberLastUsedCamera: true,
          formatsToSupport: [0, 8, 15, 9, 13, 14, 17, 18],
          aspectRatio: 1.777,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          videoConstraints: { facingMode: 'environment', focusMode: 'continuous' },
        },
        (decoded) => {
          const code = cleanScannedCode(decoded);
          stopCamera();
          handleLookupWithGuide(code);
        },
        () => {}
      );
    } catch (err) {
      setCameraOpen(false);
      if (err.name === 'NotAllowedError') toast.error('Permisos de cámara denegados');
      else toast.error('No se pudo abrir la cámara');
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try { await html5QrcodeRef.current.stop(); } catch {}
      try { html5QrcodeRef.current.clear(); } catch {}
      html5QrcodeRef.current = null;
    }
    const el = document.getElementById(CAMERA_ID);
    if (el) el.innerHTML = '';
    setCameraOpen(false);
  };

  useEffect(() => () => { stopCamera(); }, []);

  // ── Scanner remoto ────────────────────────────────
  const openRemote = async () => {
    try {
      const newSession = await remoteScannerService.createSession(warehouseId, operatorId, {});
      setRemoteSession(newSession);
      const clientUrl = `${window.location.origin}/wms/remote-scanner/client/${newSession.session_code}`;
      setRemoteClientUrl(clientUrl);
      setRemoteOpen(true);

      const channel = remoteScannerService.subscribeToSession(
        newSession.id,
        (event) => {
          console.log('📩 Returns remote event:', event);
          if (event.event_type === 'client_connected')    setRemoteConnected(true);
          if (event.event_type === 'client_disconnected') setRemoteConnected(false);
          if (event.event_type === 'scan' && event.payload?.code) {
            const code = cleanScannedCode(event.payload.code);
            remoteScannerService.sendFeedback(remoteChannelRef.current, event.client_id, true, `Buscando ${code}...`);
            closeRemote();
            handleLookupWithGuide(code);
          }
        },
        () => {}
      );
      remoteChannelRef.current = channel;
    } catch (err) {
      toast.error('Error al crear sesión remota');
    }
  };

  const closeRemote = async () => {
    if (remoteChannelRef.current) {
      await remoteScannerService.unsubscribe(remoteChannelRef.current);
      remoteChannelRef.current = null;
    }
    if (remoteSession?.id) {
      remoteScannerService.updateStatus(remoteSession.id, 'completed').catch(() => {});
    }
    setRemoteSession(null);
    setRemoteClientUrl(null);
    setRemoteConnected(false);
    setRemoteOpen(false);
  };

  useEffect(() => () => { closeRemote(); }, []);

  // ── Ajuste de ítems ───────────────────────────────
  const adjustQty    = (idx, delta) => setItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, qty: Math.max(0, it.qty + delta) }));
  const setCondition = (idx, cond) =>  setItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, condition: cond }));

  // ── Búsqueda de productos para agregar manualmente ─
  useEffect(() => {
    if (!productSearch.trim() || productSearch.length < 2) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('products')
        .select('id, name, sku')
        .or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`)
        .eq('is_active', true).limit(8);
      setProductResults(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const addProductManually = (product) => {
    if (items.some(i => i.product_id === product.id)) {
      toast.error('Producto ya en la lista');
      return;
    }
    setItems(prev => [...prev, { product_id: product.id, name: product.name, sku: product.sku, qty: 1, condition: 'good' }]);
    setProductSearch('');
    setProductResults([]);
    setShowAddProduct(false);
  };

  // ── Confirmar devolución ──────────────────────────
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
        operatorId: operatorId ?? null,
        carrierId,
        notes: notes || null,
      }, validItems.map(i => ({ product_id: i.product_id, qty: i.qty, condition: i.condition })));

      await returnsService.confirm(ret.id, operatorId);
      toast.success(`✅ Devolución ${ret.return_number} confirmada — stock repuesto`);
      onCreated?.();
      reset();
    } catch (err) {
      toast.error(err.message || 'Error al confirmar devolución');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('input'); setGuide(''); setItems([]);
    setCoordinadoraData(null); setDispatch(null); setDunamixfyData(null); setNotes('');
  };

  // ── RENDERS ───────────────────────────────────────
  const renderInput = () => (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-white/80 font-semibold text-sm flex items-center gap-2 mb-1">
          <Search className="w-4 h-4 text-primary-400" />
          Guía de devolución
        </h2>
        <p className="text-white/35 text-xs leading-relaxed">
          Ingresa o escanea el número de guía de devolución (empieza por <span className="font-mono text-white/55">300...</span> o <span className="font-mono text-white/55">397...</span>).
          Buscamos automáticamente la guía original en Coordinadora.
        </p>
      </div>

      {/* Input + buscar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={guide}
          onChange={e => setGuide(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          placeholder="Ej: 39725853690"
          className="flex-1 bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-primary-500/50 font-mono"
          autoFocus
        />
        <button
          onClick={handleLookup}
          disabled={!guide.trim() || loading}
          className="px-4 py-3 rounded-xl bg-primary-500 text-dark-950 font-bold text-sm hover:bg-primary-400 disabled:opacity-40 transition-all flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          Buscar
        </button>
      </div>

      {/* Botones de scanner */}
      <div className="flex gap-2">
        <button
          onClick={startCamera}
          className="flex-1 py-2.5 rounded-xl border border-white/[0.10] text-white/50 hover:text-white/80 hover:bg-white/[0.05] text-sm font-medium transition-all flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4 text-primary-400/70" />
          Cámara (este dispositivo)
        </button>
        <button
          onClick={openRemote}
          className="flex-1 py-2.5 rounded-xl border border-white/[0.10] text-white/50 hover:text-white/80 hover:bg-white/[0.05] text-sm font-medium transition-all flex items-center justify-center gap-2"
        >
          <Smartphone className="w-4 h-4 text-primary-400/70" />
          Escanear con teléfono
        </button>
      </div>

      <a
        href={`https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guide.trim() || '0'}`}
        target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-white/25 hover:text-primary-400/60 transition-colors"
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
        <p className="text-white/35 text-xs mt-1">Guía: <span className="font-mono text-white/50">{guide}</span></p>
      </div>
    </Card>
  );

  // Determina la fuente de los ítems
  const itemSource = dispatch ? 'dispatch' : dunamixfyData ? 'dunamixfy' : 'none';

  const renderFound = () => (
    <div className="space-y-4">
      {/* Info guías */}
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
                <span className="text-white/55 text-xs">{coordinadoraData.guideStatus}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">Encontrada</span>
          </div>
        </div>

        {dispatch && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-4">
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest">Despacho original</p>
              <p className="text-white/70 font-mono text-xs mt-0.5">{dispatch.dispatch_number}</p>
            </div>
            {dispatch.shipment_record?.carriers && (
              <div>
                <p className="text-white/35 text-[10px] uppercase tracking-widest">Transportadora</p>
                <p className="text-white/70 text-xs mt-0.5">{dispatch.shipment_record.carriers.name}</p>
              </div>
            )}
          </div>
        )}

        {/* Fuente de ítems */}
        {itemSource === 'dunamixfy' && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <p className="text-white/35 text-xs">Productos obtenidos de Dunamixfy (el despacho no está en esta bodega)</p>
          </div>
        )}
        {itemSource === 'none' && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-400/80 text-xs">No encontramos información de productos. Agrégalos manualmente abajo.</p>
          </div>
        )}
      </Card>

      {/* Productos */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-white/70 font-semibold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary-400" />
            Productos a devolver
          </h3>
          <button
            onClick={() => setShowAddProduct(p => !p)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/50 hover:text-white/75 transition-all"
          >
            <Plus className="w-3 h-3" /> Agregar
          </button>
        </div>

        {/* Buscador de producto manual */}
        {showAddProduct && (
          <div className="px-4 py-3 border-b border-white/[0.06] space-y-2">
            <input
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-3 py-2 text-white placeholder-white/25 text-sm focus:outline-none focus:border-primary-500/50"
              autoFocus
            />
            {productResults.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                {productResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProductManually(p)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/[0.06] border-b border-white/[0.04] last:border-0 transition-colors"
                  >
                    <p className="text-white/80 text-sm">{p.name}</p>
                    <p className="text-white/35 text-xs font-mono">{p.sku}</p>
                  </button>
                ))}
              </div>
            )}
            {productSearch.length >= 2 && productResults.length === 0 && (
              <p className="text-white/30 text-xs px-1">Sin resultados para "{productSearch}"</p>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-white/35 text-sm">Sin productos — usa "Agregar" para añadirlos manualmente</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((item, idx) => (
              <div key={`${item.product_id}-${idx}`} className={`px-4 py-3 flex items-center gap-3 ${item.qty === 0 ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{item.name}</p>
                  <p className="text-white/35 text-xs font-mono">{item.sku}</p>
                </div>
                <div className="flex gap-1">
                  {['good', 'damaged'].map(cond => (
                    <button key={cond} onClick={() => setCondition(idx, cond)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                        item.condition === cond
                          ? cond === 'good' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-white/[0.04] border-white/[0.08] text-white/35 hover:text-white/60'
                      }`}>
                      {cond === 'good' ? 'Buen estado' : 'Dañado'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => adjustQty(idx, -1)} className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center">
                    <Minus className="w-3 h-3 text-white/50" />
                  </button>
                  <span className="w-8 text-center text-white/80 font-mono font-bold text-sm">{item.qty}</span>
                  <button onClick={() => adjustQty(idx, +1)} className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center">
                    <Plus className="w-3 h-3 text-white/50" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notas */}
      <Card className="p-4">
        <label className="block text-white/45 text-xs mb-2">Notas (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Motivo de la devolución, observaciones..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-sm resize-none focus:outline-none focus:border-primary-500/40"
        />
      </Card>

      {/* Acciones */}
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-4 py-2.5 rounded-xl border border-white/[0.10] text-white/45 hover:text-white/70 hover:bg-white/[0.05] text-sm font-medium transition-all flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" /> Nueva búsqueda
        </button>
        <button onClick={handleConfirm}
          disabled={loading || items.filter(i => i.qty > 0).length === 0}
          className="flex-1 py-2.5 rounded-xl bg-primary-500 text-dark-950 font-bold text-sm hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
          Confirmar Devolución — Reponer Stock
        </button>
      </div>
    </div>
  );

  const renderManual = () => (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-semibold text-sm">Guía asociada no encontrada</p>
            <p className="text-white/40 text-xs mt-1 leading-relaxed">
              Coordinadora no tiene una guía anterior asociada a este número. Puede que no sea
              una devolución o que aún no esté registrada.
            </p>
          </div>
        </div>
        <a href={`https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia=${guide.trim()}`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-primary-400/80 hover:text-primary-400 transition-all">
          <ExternalLink className="w-3.5 h-3.5" />
          Ver tracking de {guide.trim()} en Coordinadora.com
        </a>
      </Card>
      <button onClick={reset}
        className="w-full py-2.5 rounded-xl border border-white/[0.10] text-white/40 hover:text-white/65 hover:bg-white/[0.04] text-sm font-medium transition-all">
        Intentar con otra guía de devolución
      </button>
    </div>
  );

  return (
    <div>
      {/* Modales */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-dark-950/80 backdrop-blur-xl border-b border-white/[0.08]">
            <div>
              <p className="text-white font-bold text-sm">Escanear Guía de Devolución</p>
              <p className="text-white/40 text-xs mt-0.5">Apunta al QR o barcode de la guía de devolución</p>
            </div>
            <button onClick={stopCamera} className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] transition-colors">
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
          <div className="flex-1 relative">
            <div id={CAMERA_ID} className="w-full h-full" />
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <div className="px-4 py-2 rounded-full bg-dark-950/70 backdrop-blur-sm border border-white/[0.10]">
                <p className="text-white/55 text-xs text-center">
                  Busca la guía de retorno — código <span className="text-primary-400 font-mono">300...</span> o <span className="text-primary-400 font-mono">397...</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {remoteOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Scanner Remoto</p>
                <p className="text-white/40 text-xs">Escanea desde tu teléfono</p>
              </div>
              <button onClick={closeRemote} className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] transition-colors">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
              remoteConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.04] border-white/[0.08] text-white/40'
            }`}>
              {remoteConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {remoteConnected ? 'Teléfono conectado — escanea la guía' : 'Esperando conexión del teléfono...'}
            </div>
            {remoteClientUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-2xl bg-white">
                  <QRCodeSVG value={remoteClientUrl} size={192} />
                </div>
                <p className="text-white/30 text-xs text-center">
                  Abre la app en tu teléfono y escanea el QR.<br />
                  Código: <span className="font-mono text-white/55">{remoteSession?.session_code}</span>
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </Card>
        </div>
      )}

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
                  {new Date(ret.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
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
  const [tab, setTab]           = useState('new');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = () => { setRefreshKey(k => k + 1); setTab('history'); };

  if (!warehouseId) return (
    <div className="p-6 max-w-xl mx-auto">
      <Card className="p-8 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400/60" />
        <p className="text-white/60 font-semibold text-sm">Selecciona una bodega</p>
        <p className="text-white/35 text-xs">Necesitas tener una bodega activa para gestionar devoluciones.</p>
      </Card>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-white font-bold text-xl flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-primary-400" />
          Devoluciones
        </h1>
        <p className="text-white/40 text-sm mt-1">Coordinadora — Rastreo automático de guía asociada</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
        {[{ key: 'new', label: 'Nueva Devolución' }, { key: 'history', label: 'Historial' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'text-white/40 hover:text-white/65'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'new'     && <NewReturn onCreated={handleCreated} />}
      {tab === 'history' && <ReturnsList refreshKey={refreshKey} />}
    </div>
  );
}
