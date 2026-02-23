// =====================================================
// REMOTE SCANNER HOST - Dunamix WMS
// =====================================================
// Componente PC/Desktop que actúa como HOST
// - Genera QR code para que móviles se conecten
// - Muestra dashboard en tiempo real
// - Procesa todas las guías
// - Envía feedback a móviles via Realtime
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useWMS } from '../../hooks/useWMS';
import { useScannerCache } from '../../hooks/useScannerCache';
import { remoteScannerService } from '../../services/remoteScannerService';
import { inventoryService } from '../../services/wmsService';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Users,
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Pause,
  Play,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export function RemoteScannerHost() {
  const navigate = useNavigate();
  const { selectedWarehouse, operatorId } = useStore();

  // WMS + Cache hooks
  const {
    isLoading: isCacheLoading,
    findProductBySku,
    hasStock,
    getStock,
    updateStockLocal,
    refresh: refreshCache
  } = useScannerCache(selectedWarehouse?.id);

  const { scanGuideForDispatch, confirmDispatch, isProcessing } = useWMS({
    findProductBySku,
    hasStock,
    getStock
  });

  // Estado de la sesión
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null); // 🔥 REF para evitar stale state en callbacks
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('active'); // 'active' | 'paused' | 'completed'

  // Realtime
  const [isConnected, setIsConnected] = useState(false);
  const realtimeChannel = useRef(null);

  // Heartbeat HOST→CLIENT (mantiene canal vivo y permite que CLIENT detecte desconexión)
  const heartbeatInterval = useRef(null);

  // Clientes conectados
  const [connectedClients, setConnectedClients] = useState(new Set());

  // Batch de dispatches (igual que ScanGuide)
  const [dispatchesBatch, setDispatchesBatch] = useState([]);

  // Stats de sesión
  const [sessionStats, setSessionStats] = useState({
    total_scanned: 0,
    total_success: 0,
    total_errors: 0
  });

  // Último escaneo (para feedback visual)
  const [lastScan, setLastScan] = useState(null);

  // Verificar warehouse y operator
  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
      return;
    }

    if (!operatorId) {
      toast.error('Debe hacer login primero');
      navigate('/');
      return;
    }

    // Crear sesión automáticamente
    createSession();

    return () => {
      // Detener heartbeat
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);

      // Cleanup canal Realtime
      if (realtimeChannel.current) {
        remoteScannerService.unsubscribe(realtimeChannel.current);
      }

      // Marcar sesión como completada
      if (session?.id) {
        remoteScannerService.updateStatus(session.id, 'completed');
      }
    };
  }, [selectedWarehouse, operatorId]);

  /**
   * Crear sesión de Remote Scanner
   */
  async function createSession() {
    setIsCreatingSession(true);
    try {
      const newSession = await remoteScannerService.createSession(
        selectedWarehouse.id,
        operatorId,
        {
          allowMultipleClients: true,
          autoConfirm: false
        }
      );

      setSession(newSession);
      sessionRef.current = newSession; // 🔥 Sincronizar ref
      console.log('✅ Sesión creada:', newSession);

      // Subscribirse a eventos via Realtime
      subscribeToEvents(newSession.id);

      toast.success(`Sesión creada: ${newSession.session_code}`);

    } catch (error) {
      console.error('❌ Error al crear sesión:', error);
      toast.error('Error al crear sesión remota');
    } finally {
      setIsCreatingSession(false);
    }
  }

  /**
   * Subscribirse a eventos de la sesión via Supabase Realtime
   * Con detección real del estado del canal
   */
  function subscribeToEvents(sessionId) {
    const channel = remoteScannerService.subscribeToSession(
      sessionId,
      handleEvent,
      handleChannelStatus  // ← detecta SUBSCRIBED / CLOSED / CHANNEL_ERROR
    );
    realtimeChannel.current = channel;
  }

  /**
   * Detectar estado real del canal Supabase Realtime
   */
  function handleChannelStatus(status) {
    console.log(`📡 HOST - Estado canal: ${status}`);
    if (status === 'SUBSCRIBED') {
      setIsConnected(true);
      // Iniciar heartbeat: enviar ping a clientes cada 30s
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = setInterval(() => {
        if (realtimeChannel.current) {
          remoteScannerService.sendHeartbeat(realtimeChannel.current);
        }
      }, 30000);
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      setIsConnected(false);
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      console.warn(`⚠️ HOST canal caído: ${status}`);
      toast.error('Conexión Realtime perdida - reconectando...', { duration: 4000 });
      // Supabase Realtime hace reconexión automática interna - solo actualizar UI
    }
  }

  /**
   * Handler de eventos Realtime
   */
  async function handleEvent(event) {
    console.log('📩 Evento recibido:', event);

    switch (event.event_type) {
      case 'scan':
        await handleRemoteScan(event);
        break;

      case 'client_connected':
        handleClientConnected(event);
        break;

      case 'client_disconnected':
        handleClientDisconnected(event);
        break;

      case 'status_change':
        handleStatusChange(event);
        break;

      case 'feedback':
        // El Host recibe sus propios eventos de feedback (Realtime broadcast)
        // No hay que procesarlos aquí - son para el Mobile Client
        break;

      default:
        console.log('⚠️ Tipo de evento desconocido:', event.event_type);
    }
  }

  /**
   * Procesar escaneo remoto (enviado desde Mobile)
   */
  async function handleRemoteScan(event) {
    const { code } = event.payload;
    const clientId = event.client_id;

    console.log(`📦 Procesando escaneo remoto: ${code} (cliente: ${clientId})`);

    // 🔥 USAR REF en lugar de state (evita stale closure)
    const currentSession = sessionRef.current;
    if (!currentSession?.id) {
      console.error('❌ Sesión no disponible en ref');
      return;
    }

    try {
      // Procesar guía con WMS (igual que ScanGuide.jsx)
      const result = await scanGuideForDispatch(code, operatorId);

      console.log('📊 Categoría de guía:', result.category);

      // ⚡ FEEDBACK INMEDIATO al móvil via Broadcast (no espera BD)
      const isSuccess = result.category === 'SUCCESS';
      remoteScannerService.sendFeedback(
        realtimeChannel.current,
        clientId,
        isSuccess,
        isSuccess
          ? `✅ ${result.feedbackInfo?.customerName || 'Guía procesada'}`
          : `❌ ${result.message || 'Error al procesar'}`,
        { category: result.category }
      );

      // Agregar al batch (sin await - operación local)
      setDispatchesBatch(prev => [...prev, {
        ...result,
        category: result.category || 'SUCCESS',
        scannedAt: new Date(),
        clientId
      }]);

      // Actualizar último escaneo (sin await)
      setLastScan({
        code: result.feedbackInfo?.code || code,
        carrier: result.carrierInfo?.name,
        category: result.category,
        customerName: result.feedbackInfo?.customerName,
        success: isSuccess,
        timestamp: new Date()
      });

      // ⚡ Actualizar stats en BD en BACKGROUND (sin await - no bloquea)
      setSessionStats(prev => {
        const newStats = {
          total_scanned: prev.total_scanned + 1,
          total_success: isSuccess ? prev.total_success + 1 : prev.total_success,
          total_errors: !isSuccess ? prev.total_errors + 1 : prev.total_errors
        };
        // Fire-and-forget: actualizar BD sin bloquear UI
        remoteScannerService.updateStats(currentSession.id, newStats).catch(console.warn);
        return newStats;
      });

    } catch (error) {
      console.error('❌ Error al procesar escaneo:', error);

      // ⚡ Enviar error al cliente inmediatamente via Broadcast
      remoteScannerService.sendFeedback(
        realtimeChannel.current,
        clientId,
        false,
        `❌ ${error.message || 'Error al procesar guía'}`,
        { error: error.message }
      );

      // ⚡ Stats en background
      setSessionStats(prev => {
        const newStats = {
          total_scanned: prev.total_scanned + 1,
          total_success: prev.total_success,
          total_errors: prev.total_errors + 1
        };
        remoteScannerService.updateStats(currentSession.id, newStats).catch(console.warn);
        return newStats;
      });
    }
  }

  /**
   * Cliente conectado
   */
  function handleClientConnected(event) {
    const clientId = event.payload.client_id;
    const clientCount = connectedClients.size + 1;
    console.log(`✅ Cliente conectado: ${clientId}`);

    setConnectedClients(prev => new Set([...prev, clientId]));

    // Toast más llamativo
    toast.success(
      `🎉 ¡Móvil ${clientCount} conectado!\n✅ Listo para escanear guías`,
      {
        duration: 5000,
        icon: '📱',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: 'bold'
        }
      }
    );

    // Reproducir sonido de éxito
    playSuccessSound();
  }

  /**
   * Cliente desconectado
   */
  function handleClientDisconnected(event) {
    const clientId = event.payload.client_id;
    console.log(`❌ Cliente desconectado: ${clientId}`);

    setConnectedClients(prev => {
      const newSet = new Set(prev);
      newSet.delete(clientId);
      return newSet;
    });
    toast(`📱 Móvil desconectado (${clientId.substring(0, 8)}...)`, { icon: '👋' });
  }

  /**
   * Cambio de estado de sesión
   */
  function handleStatusChange(event) {
    const { status } = event.payload;
    console.log(`🔄 Estado de sesión cambiado: ${status}`);
    setSessionStatus(status);
  }

  /**
   * Pausar/Reanudar sesión
   */
  async function togglePause() {
    const newStatus = sessionStatus === 'active' ? 'paused' : 'active';
    try {
      // ⚡ Pasar canal para broadcast instantáneo al móvil
      await remoteScannerService.updateStatus(session.id, newStatus, realtimeChannel.current);
      setSessionStatus(newStatus);
      toast(newStatus === 'paused' ? '⏸️ Sesión pausada' : '▶️ Sesión reanudada');
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      toast.error('Error al cambiar estado de sesión');
    }
  }

  /**
   * Confirmar batch
   */
  async function handleConfirmBatch() {
    try {
      const successItems = dispatchesBatch.filter(item => item.category === 'SUCCESS');

      if (successItems.length === 0) {
        toast.error('No hay guías nuevas para confirmar');
        return;
      }

      toast.loading(`Confirmando ${successItems.length} despachos...`, { id: 'confirm' });

      // ⭐ PRE-VALIDACIÓN DE STOCK PARA TODO EL BATCH
      const allBatchItems = successItems.flatMap(item =>
        (item.dispatch?.items || []).map(i => ({
          product_id: i.product_id,
          sku: i.sku,
          qty: i.qty
        }))
      );

      if (allBatchItems.length > 0 && allBatchItems.some(i => i.product_id)) {
        const batchValidation = await inventoryService.validateBatchStock(
          selectedWarehouse.id,
          allBatchItems
        );

        if (!batchValidation.valid) {
          const insufficientItems = batchValidation.results
            .filter(r => r.insufficient)
            .map(r => `${r.sku || r.product_id} (necesita ${r.requested}, hay ${r.available})`)
            .join(', ');
          toast.error(`Stock insuficiente: ${insufficientItems}`, { id: 'confirm', duration: 8000 });
          return;
        }
      }

      // Confirmar cada guía individualmente (skip stock validation ya validado en lote)
      let confirmed = 0;
      const errors = [];

      for (const item of successItems) {
        try {
          await confirmDispatch(item.dispatch, item.shipmentRecord?.id, { skipStockValidation: true });
          confirmed++;
          console.log(`✅ Dispatch ${confirmed}/${successItems.length} confirmado`);
        } catch (itemError) {
          console.error(`❌ Error confirmando guía ${item.dispatch?.guide_code}:`, itemError);
          errors.push(item.dispatch?.guide_code || 'desconocida');
        }
      }

      // Mostrar resultado real
      if (confirmed > 0 && errors.length === 0) {
        toast.success(`✅ ${confirmed} despachos confirmados`, { id: 'confirm' });
      } else if (confirmed > 0 && errors.length > 0) {
        toast(`⚠️ ${confirmed} confirmadas, ${errors.length} con error`, { id: 'confirm', duration: 6000 });
      } else {
        toast.error(`❌ No se pudo confirmar ningún despacho`, { id: 'confirm' });
        return;
      }

      // Refrescar cache
      await refreshCache();

      // Limpiar batch y completar sesión
      setDispatchesBatch([]);
      await remoteScannerService.updateStatus(sessionRef.current?.id || session.id, 'completed');
      navigate('/wms');

    } catch (error) {
      console.error('Error al confirmar batch:', error);
      toast.error(error.message || 'Error al confirmar despachos', { id: 'confirm' });
    }
  }

  /**
   * Reproducir sonido de éxito (conexión de cliente)
   */
  function playSuccessSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Doble beep ascendente (alegre)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido');
    }
  }

  // Calcular stats del batch
  const batchStats = {
    success: dispatchesBatch.filter(item => item.category === 'SUCCESS').length,
    errors: dispatchesBatch.filter(item => item.category !== 'SUCCESS').length,
    total: dispatchesBatch.length
  };

  // URL para QR code (Mobile escaneará esto)
  const qrUrl = session
    ? `${window.location.origin}/wms/remote-scanner/client/${session.session_code}`
    : '';

  // Loading mientras crea sesión o carga cache
  if (isCreatingSession || isCacheLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">
            {isCacheLoading ? '⚡ Optimizando Scanner...' : '🔧 Creando Sesión Remota...'}
          </h2>
          <p className="text-white/60 text-sm">
            {isCacheLoading ? 'Cargando productos y stock en memoria' : 'Generando código QR para conexión'}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">Error al crear sesión</h2>
          <button
            onClick={() => navigate('/wms')}
            className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all"
          >
            Volver al WMS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/wms')}
            className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="flex items-center gap-3">
            {/* Status Realtime */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              isConnected
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            {/* Botón Pausar/Reanudar */}
            <button
              onClick={togglePause}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                sessionStatus === 'paused'
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }`}
            >
              {sessionStatus === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {sessionStatus === 'paused' ? 'Reanudar' : 'Pausar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Columna Izquierda: QR Code + Info */}
          <div className="lg:col-span-1 space-y-6">

            {/* QR Code Card */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h2 className="text-white font-bold text-xl mb-4 text-center">
                📱 Conectar Móvil
              </h2>

              {/* QR Code */}
              <div className="bg-white p-6 rounded-xl mb-4">
                <QRCodeSVG
                  value={qrUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                  className="w-full h-auto"
                />
              </div>

              {/* Código de sesión */}
              <div className="text-center">
                <p className="text-white/60 text-sm mb-2">Código de Sesión:</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/20 border border-primary-500/30 rounded-xl">
                  <span className="text-primary-400 font-mono font-bold text-2xl tracking-wider">
                    {session.session_code}
                  </span>
                </div>
              </div>

              {/* Instrucciones */}
              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white/80 text-sm">
                  <strong>Instrucciones:</strong><br/>
                  1. Abre el scanner en tu móvil<br/>
                  2. Escanea este código QR<br/>
                  3. ¡Listo! Empieza a escanear guías
                </p>
              </div>
            </div>

            {/* Clientes Conectados - MEJORADO */}
            <div className={`backdrop-blur-xl rounded-2xl border p-6 transition-all duration-300 ${
              connectedClients.size === 0
                ? 'bg-orange-500/5 border-orange-500/20'
                : 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className={`w-5 h-5 transition-colors ${
                    connectedClients.size === 0 ? 'text-orange-400' : 'text-green-400'
                  }`} />
                  <h3 className="text-white font-bold">Móviles Conectados</h3>
                </div>
                <div className={`px-3 py-1 rounded-lg font-bold text-lg ${
                  connectedClients.size === 0
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {connectedClients.size}
                </div>
              </div>

              {connectedClients.size === 0 ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center">
                    <Users className="w-8 h-8 text-orange-400" />
                  </div>
                  <p className="text-orange-400 font-medium mb-2">⚠️ Esperando conexión</p>
                  <p className="text-white/40 text-sm">
                    Escanea el código QR con tu móvil<br/>
                    para empezar a usar Remote Scanner
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header exitoso */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">
                      ✅ Móvil{connectedClients.size > 1 ? 'es' : ''} conectado{connectedClients.size > 1 ? 's' : ''} - Listo para escanear
                    </span>
                  </div>

                  {/* Lista de clientes */}
                  <div className="space-y-2">
                    {Array.from(connectedClients).map((clientId, index) => (
                      <div
                        key={clientId}
                        className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                      >
                        <div className="relative">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                          <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            📱 Móvil #{index + 1}
                          </p>
                          <p className="text-white/40 text-xs font-mono">
                            ID: {clientId.substring(0, 12)}...
                          </p>
                        </div>
                        <div className="text-green-400 text-xs font-bold px-2 py-1 bg-green-500/20 rounded">
                          ACTIVO
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Columna Derecha: Stats + Último Escaneo + Batch */}
          <div className="lg:col-span-2 space-y-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* Total Escaneadas */}
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Package className="w-5 h-5 text-cyan-400" />
                  </div>
                  <p className="text-white/60 text-sm font-medium">TOTAL</p>
                </div>
                <p className="text-4xl font-bold text-white">{sessionStats.total_scanned}</p>
                <p className="text-cyan-400 text-xs mt-1">Guías escaneadas</p>
              </div>

              {/* Exitosas */}
              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 backdrop-blur-xl rounded-2xl border border-green-500/20 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-white/60 text-sm font-medium">EXITOSAS</p>
                </div>
                <p className="text-4xl font-bold text-white">{sessionStats.total_success}</p>
                <p className="text-green-400 text-xs mt-1">Procesadas correctamente</p>
              </div>

              {/* Errores */}
              <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-xl rounded-2xl border border-red-500/20 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <p className="text-white/60 text-sm font-medium">ERRORES</p>
                </div>
                <p className="text-4xl font-bold text-white">{sessionStats.total_errors}</p>
                <p className="text-red-400 text-xs mt-1">Repetidas o errores</p>
              </div>
            </div>

            {/* Último Escaneo */}
            {lastScan && (
              <div className={`bg-white/5 backdrop-blur-xl rounded-2xl border p-6 ${
                lastScan.success
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-red-500/30 bg-red-500/5'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {lastScan.success ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                  <h3 className="text-white font-bold text-lg">Último Escaneo</h3>
                  <span className="text-white/40 text-sm ml-auto">
                    {lastScan.timestamp.toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/40 mb-1">Código</p>
                    <p className="text-white font-mono">{lastScan.code}</p>
                  </div>
                  <div>
                    <p className="text-white/40 mb-1">Transportadora</p>
                    <p className="text-white">{lastScan.carrier || 'N/A'}</p>
                  </div>
                  {lastScan.customerName && (
                    <div className="col-span-2">
                      <p className="text-white/40 mb-1">Cliente</p>
                      <p className="text-white">{lastScan.customerName}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Batch Summary */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Batch Actual</h3>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-bold">{batchStats.success} ✅</span>
                  <span className="text-white/40">|</span>
                  <span className="text-red-400 font-bold">{batchStats.errors} ❌</span>
                </div>
              </div>

              {dispatchesBatch.length === 0 ? (
                <p className="text-white/40 text-center py-8">
                  Sin guías escaneadas aún.<br/>
                  Esperando escaneos desde móviles conectados...
                </p>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                    {dispatchesBatch.slice(-10).reverse().map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          item.category === 'SUCCESS'
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-mono text-sm">
                            {item.dispatch?.guide_code || item.feedbackInfo?.code}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.category === 'SUCCESS'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {item.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {batchStats.success > 0 && (
                    <button
                      onClick={handleConfirmBatch}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-xl text-white font-bold transition-all disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" />
                      Confirmar {batchStats.success} Despacho{batchStats.success > 1 ? 's' : ''}
                    </button>
                  )}
                </>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default RemoteScannerHost;
