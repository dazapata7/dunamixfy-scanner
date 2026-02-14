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
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('active'); // 'active' | 'paused' | 'completed'

  // Realtime
  const [isConnected, setIsConnected] = useState(false);
  const realtimeChannel = useRef(null);

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
      // Cleanup al desmontar
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
   */
  function subscribeToEvents(sessionId) {
    const channel = remoteScannerService.subscribeToSession(sessionId, handleEvent);
    realtimeChannel.current = channel;

    // Actualizar estado de conexión
    setIsConnected(true);
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

    try {
      // Procesar guía con WMS (igual que ScanGuide.jsx)
      const result = await scanGuideForDispatch(code, operatorId);

      console.log('📊 Categoría de guía:', result.category);

      // Agregar al batch
      setDispatchesBatch(prev => [...prev, {
        ...result,
        category: result.category || 'SUCCESS',
        scannedAt: new Date(),
        clientId // Tracking de qué cliente escaneó
      }]);

      // Actualizar stats
      const newStats = {
        total_scanned: sessionStats.total_scanned + 1,
        total_success: result.category === 'SUCCESS' ? sessionStats.total_success + 1 : sessionStats.total_success,
        total_errors: result.category !== 'SUCCESS' ? sessionStats.total_errors + 1 : sessionStats.total_errors
      };
      setSessionStats(newStats);

      // Actualizar stats en BD
      await remoteScannerService.updateStats(session.id, newStats);

      // Actualizar último escaneo
      setLastScan({
        code: result.feedbackInfo?.code || code,
        carrier: result.carrierInfo?.name,
        category: result.category,
        customerName: result.feedbackInfo?.customerName,
        success: result.category === 'SUCCESS',
        timestamp: new Date()
      });

      // Enviar feedback al cliente móvil
      await remoteScannerService.sendFeedback(
        session.id,
        clientId,
        result.category === 'SUCCESS',
        result.category === 'SUCCESS'
          ? `✅ ${result.dispatch?.dispatch_number || 'Guía procesada'}`
          : `❌ ${result.message || 'Error al procesar'}`,
        {
          category: result.category,
          dispatch_number: result.dispatch?.dispatch_number
        }
      );

    } catch (error) {
      console.error('❌ Error al procesar escaneo:', error);

      // Enviar error al cliente
      await remoteScannerService.sendFeedback(
        session.id,
        clientId,
        false,
        `❌ ${error.message || 'Error al procesar guía'}`,
        { error: error.message }
      );

      // Actualizar stats con error
      const newStats = {
        ...sessionStats,
        total_scanned: sessionStats.total_scanned + 1,
        total_errors: sessionStats.total_errors + 1
      };
      setSessionStats(newStats);
      await remoteScannerService.updateStats(session.id, newStats);
    }
  }

  /**
   * Cliente conectado
   */
  function handleClientConnected(event) {
    const clientId = event.payload.client_id;
    console.log(`✅ Cliente conectado: ${clientId}`);

    setConnectedClients(prev => new Set([...prev, clientId]));
    toast.success(`📱 Móvil conectado (${clientId.substring(0, 8)}...)`);
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
      await remoteScannerService.updateStatus(session.id, newStatus);
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

      for (const item of successItems) {
        await confirmDispatch(item.dispatch.id, item.shipmentRecord?.id);
      }

      toast.success(`✅ ${successItems.length} despachos confirmados`, { id: 'confirm' });

      // Refrescar cache
      await refreshCache();

      // Limpiar batch
      setDispatchesBatch([]);

      // Completar sesión
      await remoteScannerService.updateStatus(session.id, 'completed');
      navigate('/wms');

    } catch (error) {
      console.error('Error al confirmar batch:', error);
      toast.error(error.message || 'Error al confirmar despachos', { id: 'confirm' });
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
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

            {/* Clientes Conectados */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-bold">Móviles Conectados</h3>
              </div>

              {connectedClients.size === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">
                  Sin conexiones activas
                </p>
              ) : (
                <div className="space-y-2">
                  {Array.from(connectedClients).map(clientId => (
                    <div
                      key={clientId}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-white/80 text-sm font-mono">
                        {clientId.substring(0, 12)}...
                      </span>
                    </div>
                  ))}
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
