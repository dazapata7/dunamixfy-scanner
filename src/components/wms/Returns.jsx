// =====================================================
// RETURNS - Módulo de Devoluciones (Coordinadora)
// =====================================================
// Flujo BATCH (igual al despacho):
//   1. Abrir cámara o teléfono remoto
//   2. Escanear múltiples guías de devolución
//   3. Cada guía se resuelve automáticamente
//   4. Lista acumulada: ✅ encontradas / ⚠️ error
//   5. Revisar y aprobar → repone stock
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
  Wifi, WifiOff, CheckCircle2, XCircle, Loader2, Trash2,
  Keyboard
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────
const STATUS_MAP = {
  draft:     { label: 'Borrador',   color: 'bg-yellow-500/15 text-yellow-400  border-yellow-500/20' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelada',  color: 'bg-red-500/15     text-red-400    border-red-500/20'    },
};

// Limpia barcode/QR de devolución usando config de la transportadora.
// Extracción desde el FINAL: el prefijo varía (barcode vs QR), el sufijo es fijo.
//
//   Barcode: 739725853690001          → slice(-14, -3) = "39725853690"
//   QR:      70020010200040630339725853690001 → slice(-14, -3) = "39725853690"
//
// Config: guide_length=11, suffix_length=3 → offset = -(11+3)=-14
function cleanReturnCode(raw, carrierConfig = null) {
  let code = String(raw).trim();
  // Sufijo .X del QR legacy: "39725853690.1" → "39725853690"
  code = code.replace(/\.[\d]+$/, '');

  const guideLen   = carrierConfig?.return_barcode_guide_length  ?? 11; // default Coordinadora
  const suffixLen  = carrierConfig?.return_barcode_suffix_length ?? 3;  // default "001"
  const offset     = guideLen + suffixLen; // chars desde el final donde empieza la guía

  // Solo aplicar si el código es suficientemente largo y contiene dígitos
  if (/^\d+$/.test(code) && code.length >= offset) {
    code = suffixLen > 0
      ? code.slice(-offset, -suffixLen)
      : code.slice(-offset);
  }
  return code;
}

function StatusBadge({ status }) {
  const { label, color } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>{label}</span>;
}

function Card({ children, className = '' }) {
  return <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm ${className}`}>{children}</div>;
}

// ── Scanner de cámara compartido ──────────────────────
const CAMERA_ID = 'return-camera-scanner';

async function startCameraScanner(onScan, onError) {
  const el = document.getElementById(CAMERA_ID);
  if (el) el.innerHTML = '';
  const { Html5Qrcode } = await import('html5-qrcode');
  const scanner = new Html5Qrcode(CAMERA_ID);
  await scanner.start(
    { facingMode: 'environment' },
    {
      fps: 30,
      qrbox: (w, h) => ({ width: Math.floor(w * 0.92), height: Math.floor(h * 0.45) }),
      rememberLastUsedCamera: true,
      formatsToSupport: [0, 8, 15, 9, 13, 14, 17, 18],
      aspectRatio: 1.777,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      videoConstraints: { facingMode: 'environment', focusMode: 'continuous' },
    },
    onScan,
    () => {}
  );
  return scanner;
}

// ── Vista: Nueva Devolución (BATCH) ──────────────────
function NewReturn({ onCreated }) {
  const warehouseId = useStore(s => s.selectedWarehouse?.id);
  const operatorId  = useStore(s => s.operatorId);

  // Configuración de transportadoras (para patrones de barcode)
  const [carriers, setCarriers] = useState([]);
  useEffect(() => {
    supabase.from('carriers').select('id,name,code,return_barcode_total_length,return_barcode_prefix,return_barcode_guide_length,return_tracking_url')
      .then(({ data }) => setCarriers(data ?? []));
  }, []);

  // ── Batch state ───────────────────────────────────
  // item: { id, guideCode, status: 'resolving'|'found'|'error', coordinadoraData, dispatch, dunamixfy, items, error, condition }
  const [batch, setBatch] = useState([]);
  const scanningRef = useRef(false); // evita doble proceso del mismo código
  const lastScannedRef = useRef(null);
  const cooldownRef = useRef(false);

  // ── Scanner modes ─────────────────────────────────
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [remoteOpen, setRemoteOpen]     = useState(false);
  const [remoteSession, setRemoteSession]     = useState(null);
  const [remoteClientUrl, setRemoteClientUrl] = useState(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [manualGuide,     setManualGuide]     = useState('');
  const [isManualLoading, setIsManualLoading] = useState(false);
  const html5QrcodeRef   = useRef(null);
  const remoteChannelRef = useRef(null);

  // ── Resolve: procesa una guía y la agrega al batch ─
  const resolveGuide = useCallback(async (rawCode) => {
    if (cooldownRef.current) return;
    const code = cleanReturnCode(rawCode, carriers.find(c => c.code === 'coordinadora' || c.name?.toLowerCase().includes('coordinadora')));

    if (!code || code.length < 6) return;
    if (lastScannedRef.current === code) return; // mismo código repetido
    lastScannedRef.current = code;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 2500);

    // Verificar si ya está en el batch
    if (batch.some(b => b.guideCode === code)) {
      toast('⚠️ Guía ya escaneada en este lote', { icon: '⚠️' });
      return;
    }

    const itemId = crypto.randomUUID();
    // Agregar en estado "resolving"
    setBatch(prev => [...prev, { id: itemId, guideCode: code, status: 'resolving', items: [] }]);

    try {
      const result = await returnsService.resolve(code);
      const { coordinadora, dispatch, dunamixfy } = result;

      let items = [];
      if (dispatch?.dispatch_items?.length > 0) {
        items = dispatch.dispatch_items.map(di => ({
          product_id: di.product_id,
          name:       di.products?.name ?? 'Producto',
          sku:        di.products?.sku  ?? '-',
          qty:        di.qty,
          condition:  'good',
        }));
      } else if (dunamixfy?.items?.length > 0) {
        items = dunamixfy.items.filter(i => i.product_id).map(i => ({
          product_id: i.product_id,
          name:       i.product_name ?? i.name,
          sku:        i.product_sku  ?? i.external_sku,
          qty:        i.qty,
          condition:  'good',
        }));
      }

      if (!coordinadora?.associatedGuide) {
        setBatch(prev => prev.map(b => b.id === itemId ? {
          ...b, status: 'error',
          error: 'No se encontró guía asociada en Coordinadora',
          coordinadoraData: coordinadora,
        } : b));
      } else {
        setBatch(prev => prev.map(b => b.id === itemId ? {
          ...b, status: 'found',
          coordinadoraData: coordinadora,
          dispatch, dunamixfy,
          items,
          itemSource: dispatch ? 'dispatch' : dunamixfy ? 'dunamixfy' : 'none',
        } : b));
      }
    } catch (err) {
      setBatch(prev => prev.map(b => b.id === itemId ? {
        ...b, status: 'error', error: err.message || 'Error al consultar Coordinadora',
      } : b));
    }
  }, [carriers, batch]);

  // ── Cámara ────────────────────────────────────────
  const startCamera = async () => {
    setCameraOpen(true);
    await new Promise(r => setTimeout(r, 150));
    try {
      html5QrcodeRef.current = await startCameraScanner(
        (decoded) => resolveGuide(decoded),
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

  // ── Ingreso manual de guía ────────────────────────
  const handleManualSubmit = async () => {
    const raw = manualGuide.trim();
    if (!raw) return;
    setIsManualLoading(true);
    await resolveGuide(raw);
    setManualGuide('');
    setIsManualLoading(false);
  };

  // ── Scanner remoto ────────────────────────────────
  const openRemote = async () => {
    try {
      const newSession = await remoteScannerService.createSession(warehouseId, operatorId, {});
      setRemoteSession(newSession);
      setRemoteClientUrl(`${window.location.origin}/wms/remote-scanner/client/${newSession.session_code}`);
      setRemoteOpen(true);

      const channel = remoteScannerService.subscribeToSession(
        newSession.id,
        (event) => {
          if (event.event_type === 'client_connected')    setRemoteConnected(true);
          if (event.event_type === 'client_disconnected') setRemoteConnected(false);
          if (event.event_type === 'scan' && event.payload?.code) {
            const rawCode = event.payload.code;
            remoteScannerService.sendFeedback(remoteChannelRef.current, event.client_id, true, `Procesando...`);
            resolveGuide(rawCode);
          }
        },
        () => {}
      );
      remoteChannelRef.current = channel;
    } catch { toast.error('Error al crear sesión remota'); }
  };

  const closeRemote = async () => {
    if (remoteChannelRef.current) { await remoteScannerService.unsubscribe(remoteChannelRef.current); remoteChannelRef.current = null; }
    if (remoteSession?.id) remoteScannerService.updateStatus(remoteSession.id, 'completed').catch(() => {});
    setRemoteSession(null); setRemoteClientUrl(null); setRemoteConnected(false); setRemoteOpen(false);
  };

  useEffect(() => () => { closeRemote(); }, []);

  // ── Editar ítems de un batch item ─────────────────
  const adjustQty = (batchId, idx, delta) => {
    setBatch(prev => prev.map(b => b.id !== batchId ? b : {
      ...b, items: b.items.map((it, i) => i !== idx ? it : { ...it, qty: Math.max(0, it.qty + delta) })
    }));
  };
  const setCondition = (batchId, idx, cond) => {
    setBatch(prev => prev.map(b => b.id !== batchId ? b : {
      ...b, items: b.items.map((it, i) => i !== idx ? it : { ...it, condition: cond })
    }));
  };
  const removeFromBatch = (batchId) => setBatch(prev => prev.filter(b => b.id !== batchId));

  // ── Confirmar batch completo ──────────────────────
  const [confirming, setConfirming] = useState(false);

  const handleConfirmBatch = async () => {
    if (!warehouseId) { toast.error('Selecciona una bodega primero'); return; }
    const toConfirm = batch.filter(b => b.status === 'found' && b.items.some(i => i.qty > 0));
    if (!toConfirm.length) { toast.error('No hay devoluciones válidas con productos para aprobar'); return; }

    setConfirming(true);
    let confirmed = 0, errors = 0;

    for (const item of toConfirm) {
      try {
        const carrierId = item.dispatch?.shipment_record?.carriers?.id ?? null;
        const ret = await returnsService.create({
          returnGuideCode:    item.guideCode,
          originalGuideCode:  item.coordinadoraData?.associatedGuide ?? null,
          originalDispatchId: item.dispatch?.id ?? null,
          warehouseId,
          operatorId: operatorId ?? null,
          carrierId,
          notes: null,
        }, item.items.filter(i => i.qty > 0).map(i => ({
          product_id: i.product_id, qty: i.qty, condition: i.condition,
        })));
        await returnsService.confirm(ret.id, operatorId);
        confirmed++;
        setBatch(prev => prev.map(b => b.id === item.id ? { ...b, status: 'confirmed', returnNumber: ret.return_number } : b));
      } catch (err) {
        errors++;
        setBatch(prev => prev.map(b => b.id === item.id ? { ...b, status: 'error', error: err.message } : b));
      }
    }

    setConfirming(false);
    if (confirmed > 0) {
      toast.success(`✅ ${confirmed} devolución${confirmed > 1 ? 'es' : ''} confirmada${confirmed > 1 ? 's' : ''} — stock repuesto`);
      onCreated?.();
    }
    if (errors > 0) toast.error(`❌ ${errors} devolución${errors > 1 ? 'es' : ''} con error`);
  };

  // ── Stats del batch ───────────────────────────────
  const foundCount     = batch.filter(b => b.status === 'found').length;
  const errorCount     = batch.filter(b => b.status === 'error').length;
  const resolvingCount = batch.filter(b => b.status === 'resolving').length;
  const confirmedCount = batch.filter(b => b.status === 'confirmed').length;

  // ── RENDER ────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Modal cámara full-screen */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-dark-950/80 backdrop-blur-xl border-b border-white/[0.08]">
            <div>
              <p className="text-white font-bold text-sm">Escaneando Devoluciones</p>
              <p className="text-white/40 text-xs mt-0.5">
                Escanea el QR o barcode de la guía de devolución
                {batch.length > 0 && <span className="ml-2 text-primary-400">{batch.length} en lote</span>}
              </p>
            </div>
            <button onClick={stopCamera} className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] transition-colors">
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
          <div className="flex-1 relative">
            <div id={CAMERA_ID} className="w-full h-full" />
            {/* Stats overlay */}
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-2 pointer-events-none">
              {foundCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-bold">{foundCount} encontradas</span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400 text-xs font-bold">{errorCount} errores</span>
                </div>
              )}
            </div>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <div className="px-4 py-2 rounded-full bg-dark-950/70 backdrop-blur-sm border border-white/[0.10]">
                <p className="text-white/55 text-xs text-center">
                  Busca el barcode de retorno — código <span className="text-primary-400 font-mono">397...</span> o <span className="text-primary-400 font-mono">300...</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal remoto */}
      {remoteOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Scanner Remoto — Devoluciones</p>
                <p className="text-white/40 text-xs">Escanea varias guías desde el teléfono</p>
              </div>
              <button onClick={closeRemote} className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] transition-colors">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
              remoteConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.04] border-white/[0.08] text-white/40'
            }`}>
              {remoteConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {remoteConnected ? 'Teléfono conectado — escanea las guías de devolución' : 'Esperando conexión...'}
            </div>

            {/* Stats del batch mientras escanea */}
            {batch.length > 0 && (
              <div className="flex gap-2">
                {foundCount > 0 && <div className="flex-1 text-center py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><p className="text-emerald-400 font-bold text-lg">{foundCount}</p><p className="text-emerald-400/70 text-[10px]">encontradas</p></div>}
                {resolvingCount > 0 && <div className="flex-1 text-center py-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"><p className="text-white/60 font-bold text-lg">{resolvingCount}</p><p className="text-white/35 text-[10px]">buscando</p></div>}
                {errorCount > 0 && <div className="flex-1 text-center py-2 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-red-400 font-bold text-lg">{errorCount}</p><p className="text-red-400/70 text-[10px]">errores</p></div>}
              </div>
            )}

            {remoteClientUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-2xl bg-white">
                  <QRCodeSVG value={remoteClientUrl} size={180} />
                </div>
                <p className="text-white/30 text-xs text-center">
                  Abre la app en tu teléfono, escanea el QR y luego escanea los paquetes de devolución.<br/>
                  Código: <span className="font-mono text-white/50">{remoteSession?.session_code}</span>
                </p>
                {batch.length > 0 && (
                  <button onClick={closeRemote}
                    className="w-full py-2.5 rounded-xl bg-primary-500/20 border border-primary-500/30 text-primary-400 text-sm font-semibold hover:bg-primary-500/30 transition-all">
                    Terminar escaneo y revisar ({batch.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Cabecera con botones de scanner */}
      <Card className="p-4 space-y-3">
        <div className="flex gap-2">
          <button onClick={startCamera}
            className="flex-1 py-3 rounded-xl border border-white/[0.10] text-white/55 hover:text-white/85 hover:bg-white/[0.05] text-sm font-medium transition-all flex items-center justify-center gap-2">
            <Camera className="w-4 h-4 text-primary-400/70" />
            Cámara
          </button>
          <button onClick={openRemote}
            className="flex-1 py-3 rounded-xl border border-white/[0.10] text-white/55 hover:text-white/85 hover:bg-white/[0.05] text-sm font-medium transition-all flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4 text-primary-400/70" />
            Escanear con teléfono
          </button>
        </div>
        {/* Ingreso manual */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              value={manualGuide}
              onChange={e => setManualGuide(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Ingresar guía manualmente…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-primary-500/40 transition-all"
            />
          </div>
          <button
            onClick={handleManualSubmit}
            disabled={!manualGuide.trim() || isManualLoading}
            className="px-4 py-2.5 rounded-xl bg-primary-500/15 border border-primary-500/25 text-primary-400 hover:bg-primary-500/25 transition-all disabled:opacity-30 flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
          >
            {isManualLoading
              ? <div className="w-4 h-4 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
              : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
        <p className="text-white/20 text-xs text-center">Escanea o ingresa manualmente — las guías se acumulan en el lote</p>
      </Card>

      {/* Lista del batch */}
      {batch.length > 0 && (
        <div className="space-y-2">
          {batch.map((item) => (
            <BatchItem
              key={item.id}
              item={item}
              onRemove={() => removeFromBatch(item.id)}
              onAdjustQty={(idx, delta) => adjustQty(item.id, idx, delta)}
              onSetCondition={(idx, cond) => setCondition(item.id, idx, cond)}
            />
          ))}
        </div>
      )}

      {/* Botón aprobar */}
      {batch.length > 0 && (
        <div className="space-y-2">
          {foundCount > 0 && (
            <button onClick={handleConfirmBatch} disabled={confirming}
              className="w-full py-3.5 rounded-xl bg-primary-500 text-dark-950 font-bold text-sm hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              {confirming
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
                : <><ArrowUpCircle className="w-4 h-4" /> Aprobar {foundCount} devolución{foundCount > 1 ? 'es' : ''} — Reponer Stock</>
              }
            </button>
          )}
          {(confirmedCount > 0 || errorCount > 0) && (
            <button onClick={() => setBatch([])}
              className="w-full py-2.5 rounded-xl border border-white/[0.10] text-white/40 hover:text-white/65 hover:bg-white/[0.04] text-sm font-medium transition-all">
              Limpiar lote y empezar de nuevo
            </button>
          )}
        </div>
      )}

      {batch.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <RotateCcw className="w-10 h-10 text-white/10" />
          <p className="text-white/30 text-sm">Escanea las guías de devolución para comenzar</p>
        </div>
      )}
    </div>
  );
}

// ── BatchItem: card de cada guía en el lote ───────────
function BatchItem({ item, onRemove, onAdjustQty, onSetCondition }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    resolving: <Loader2 className="w-4 h-4 text-white/40 animate-spin" />,
    found:     <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    error:     <XCircle className="w-4 h-4 text-red-400" />,
    confirmed: <CheckCircle className="w-4 h-4 text-primary-400" />,
  }[item.status];

  const bgClass = {
    resolving: 'border-white/[0.07]',
    found:     'border-emerald-500/20',
    error:     'border-red-500/20',
    confirmed: 'border-primary-500/20',
  }[item.status] ?? 'border-white/[0.07]';

  return (
    <div className={`rounded-2xl bg-white/[0.03] border ${bgClass} overflow-hidden`}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => item.status === 'found' && setExpanded(p => !p)}
      >
        {statusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-white/75 text-sm">{item.guideCode}</span>
            {item.status === 'confirmed' && (
              <span className="text-primary-400/70 text-[10px] font-mono">{item.returnNumber}</span>
            )}
          </div>
          {item.coordinadoraData?.associatedGuide && (
            <div className="flex items-center gap-1 mt-0.5">
              <ChevronRight className="w-3 h-3 text-white/25" />
              <span className="font-mono text-primary-400/70 text-xs">{item.coordinadoraData.associatedGuide}</span>
              {item.coordinadoraData.guideStatus && (
                <span className="text-white/30 text-[10px]">· {item.coordinadoraData.guideStatus}</span>
              )}
            </div>
          )}
          {item.status === 'error' && (
            <p className="text-red-400/70 text-xs mt-0.5 truncate">{item.error}</p>
          )}
          {item.status === 'found' && (
            <p className="text-white/30 text-xs mt-0.5">
              {item.items.length > 0
                ? `${item.items.filter(i => i.qty > 0).length} producto${item.items.length !== 1 ? 's' : ''} · ${item.itemSource === 'dispatch' ? 'BD' : item.itemSource === 'dunamixfy' ? 'Dunamixfy' : 'Sin info'}`
                : 'Sin productos — agrega manualmente'
              }
            </p>
          )}
        </div>
        {item.status !== 'confirmed' && (
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400/70 hover:bg-red-500/10 transition-all flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Detalle de productos (expandible) */}
      {expanded && item.status === 'found' && (
        <div className="border-t border-white/[0.06]">
          {item.items.length === 0 ? (
            <div className="px-4 py-3 text-center">
              <p className="text-white/35 text-xs">Sin productos identificados — se registrará sin ítems</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {item.items.map((it, idx) => (
                <div key={`${it.product_id}-${idx}`} className={`px-4 py-2.5 flex items-center gap-2 ${it.qty === 0 ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs font-medium truncate">{it.name}</p>
                    <p className="text-white/30 text-[10px] font-mono">{it.sku}</p>
                  </div>
                  <div className="flex gap-1">
                    {['good', 'damaged'].map(cond => (
                      <button key={cond} onClick={() => onSetCondition(idx, cond)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all ${
                          it.condition === cond
                            ? cond === 'good' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/55'
                        }`}>
                        {cond === 'good' ? '✓' : '⚠'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onAdjustQty(idx, -1)} className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center">
                      <Minus className="w-2.5 h-2.5 text-white/50" />
                    </button>
                    <span className="w-7 text-center text-white/75 font-mono font-bold text-xs">{it.qty}</span>
                    <button onClick={() => onAdjustQty(idx, +1)} className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center">
                      <Plus className="w-2.5 h-2.5 text-white/50" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vista: Historial ──────────────────────────────────
function ReturnsList({ refreshKey }) {
  const warehouseId = useStore(s => s.selectedWarehouse?.id);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!warehouseId) return;
    setLoading(true);
    returnsService.getAll(warehouseId)
      .then(setReturns).catch(err => toast.error(err.message)).finally(() => setLoading(false));
  }, [warehouseId, refreshKey]);

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!returns.length) return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <RotateCcw className="w-10 h-10 text-white/10" />
      <p className="text-white/35 text-sm">No hay devoluciones registradas</p>
    </div>
  );

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
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
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/30 text-xs font-mono">{ret.return_guide_code}</span>
                  {ret.original_guide_code && (<><ChevronRight className="w-3 h-3 text-white/15" /><span className="text-primary-400/55 text-xs font-mono">{ret.original_guide_code}</span></>)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/45 text-xs">{itemCount} producto{itemCount !== 1 ? 's' : ''}</p>
                <p className="text-white/20 text-[10px] mt-0.5">{new Date(ret.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────
export default function Returns() {
  const warehouseId = useStore(s => s.selectedWarehouse?.id);
  const [tab, setTab] = useState('new');
  const [refreshKey, setRefreshKey] = useState(0);
  const handleCreated = () => { setRefreshKey(k => k + 1); };

  if (!warehouseId) return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-8 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400/60" />
        <p className="text-white/60 font-semibold text-sm">Selecciona una bodega</p>
        <p className="text-white/35 text-xs">Necesitas tener una bodega activa para gestionar devoluciones.</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-white font-bold text-xl flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-primary-400" />
          Devoluciones
        </h1>
        <p className="text-white/40 text-sm mt-1">Coordinadora — Escaneo en lote de guías de retorno</p>
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
