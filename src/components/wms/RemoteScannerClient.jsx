// =====================================================
// REMOTE SCANNER CLIENT - Dunamix WMS
// =====================================================
// Componente MOBILE que actúa como CLIENT
// - Escanea código QR para conectarse a sesión (PC)
// - Solo cámara full-screen
// - Envía códigos escaneados al PC
// - Recibe feedback (✅/❌) y lo muestra
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { remoteScannerService } from '../../services/remoteScannerService';
import { X, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import '../../scanner-custom.css';

export function RemoteScannerClient() {
  const { sessionCode } = useParams(); // Viene del QR
  const navigate = useNavigate();

  const html5QrcodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanCooldown = useRef(false);
  const lastScannedCode = useRef(null);

  // Estado de conexión
  const [session, setSession] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [clientId] = useState(() => crypto.randomUUID()); // ID único de este cliente

  // Realtime
  const realtimeChannel = useRef(null);

  // Heartbeat (ping cada 30s para detectar desconexiones)
  const heartbeatInterval = useRef(null);

  // Feedback visual
  const [lastFeedback, setLastFeedback] = useState(null); // { success, message, timestamp }
  const [scanAnimation, setScanAnimation] = useState(null); // 'success' | 'error'

  // Conectar a sesión
  useEffect(() => {
    if (!sessionCode) {
      toast.error('Código de sesión no válido');
      navigate('/wms');
      return;
    }

    connectToSession();

    // ⚡ NUEVO: Detectar cierre de pestaña/navegador
    const handleBeforeUnload = () => {
      if (session?.id) {
        // Usar sendBeacon para garantizar que se envíe incluso al cerrar
        const payload = {
          session_id: session.id,
          event_type: 'client_disconnected',
          payload: { client_id: clientId, timestamp: new Date().toISOString() },
          client_id: clientId
        };

        // Intentar enviar con fetch keepalive (más confiable que sendBeacon para APIs)
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/remote_scanner_events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(payload),
          keepalive: true // CRÍTICO: mantiene la petición viva al cerrar
        }).catch(err => console.warn('Error al notificar desconexión:', err));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Limpiar heartbeat
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      // Cleanup normal
      if (realtimeChannel.current) {
        remoteScannerService.unsubscribe(realtimeChannel.current);
      }

      // Notificar desconexión (por si acaso)
      if (session?.id) {
        remoteScannerService.notifyClientDisconnected(session.id, clientId);
      }

      stopScanner();
    };
  }, [sessionCode, session?.id, clientId]);

  /**
   * Conectar a sesión remota
   */
  async function connectToSession() {
    setIsConnecting(true);
    try {
      // Obtener sesión por código
      const foundSession = await remoteScannerService.getSessionByCode(sessionCode);

      if (!foundSession) {
        throw new Error(`Sesión "${sessionCode}" no encontrada o expirada`);
      }

      console.log('✅ Conectado a sesión:', foundSession);
      setSession(foundSession);

      // Subscribirse a eventos (feedback del PC)
      subscribeToEvents(foundSession.id);

      // Notificar al PC que nos conectamos
      await remoteScannerService.notifyClientConnected(foundSession.id, clientId, {
        user_agent: navigator.userAgent,
        platform: navigator.platform
      });

      toast.success(`Conectado a sesión ${sessionCode}`);
      setIsConnected(true);

      // ⚡ HEARTBEAT DESHABILITADO - Causa reconnects infinitos
      // TODO: Implementar detección de desconexión en PC con timeout de última actividad
      // heartbeatInterval.current = setInterval(() => {
      //   if (foundSession.id) {
      //     console.log('💓 Heartbeat enviado');
      //   }
      // }, 30000);

      // Iniciar scanner
      startScanner();

    } catch (error) {
      console.error('❌ Error al conectar:', error);
      toast.error(error.message || 'Error al conectar a sesión');
      setTimeout(() => navigate('/wms'), 2000);
    } finally {
      setIsConnecting(false);
    }
  }

  /**
   * Subscribirse a eventos (feedback del PC)
   */
  function subscribeToEvents(sessionId) {
    const channel = remoteScannerService.subscribeToSession(sessionId, handleEvent);
    realtimeChannel.current = channel;
  }

  /**
   * Handler de eventos Realtime
   */
  function handleEvent(event) {
    console.log('📩 Evento Realtime recibido:', {
      type: event.event_type,
      payload: event.payload,
      myClientId: clientId
    });

    if (event.event_type === 'feedback') {
      // Verificar si es para este cliente
      if (event.payload.client_id === clientId) {
        console.log('✅ Feedback es para MÍ - procesando...');
        handleFeedback(event.payload);
      } else {
        console.log('⏭️ Feedback es para otro cliente:', event.payload.client_id);
      }
    }

    if (event.event_type === 'status_change') {
      // Sesión pausada/completada
      handleStatusChange(event.payload);
    }
  }

  /**
   * Recibir feedback del PC
   */
  function handleFeedback(payload) {
    console.log('✅ Feedback recibido del PC:', payload);

    const { success, message } = payload;

    // Cerrar toast de "Procesando..."
    toast.dismiss('processing');

    // Actualizar feedback visual
    setLastFeedback({
      success,
      message,
      timestamp: new Date()
    });

    // Animación + Sonido + Vibración
    setScanAnimation(success ? 'success' : 'error');

    if (success) {
      playSuccessSound();
      vibrate([100]);
      toast.success(message, { duration: 2000 });
    } else {
      playErrorSound();
      vibrate([200, 100, 200]);
      toast.error(message, { duration: 3000 });
    }

    // Limpiar animación después de 1s
    setTimeout(() => {
      setScanAnimation(null);
    }, 1000);

    // 🔥 FIX: Liberar cooldown INMEDIATAMENTE para poder escanear siguiente código
    setTimeout(() => {
      scanCooldown.current = false;
      lastScannedCode.current = null;
      console.log('✅ Cooldown liberado - Listo para siguiente escaneo');
    }, 1000); // Reducido de 1500ms a 1000ms
  }

  /**
   * Cambio de estado de sesión
   */
  function handleStatusChange(payload) {
    const { status } = payload;

    if (status === 'paused') {
      toast('⏸️ Sesión pausada por el HOST', { duration: 3000 });
      stopScanner();
    } else if (status === 'active') {
      toast('▶️ Sesión reanudada', { duration: 2000 });
      startScanner();
    } else if (status === 'completed') {
      toast.success('✅ Sesión completada', { duration: 3000 });
      setTimeout(() => navigate('/wms'), 2000);
    }
  }

  /**
   * Iniciar scanner (IDÉNTICO a ScanGuide.jsx)
   */
  const startScanner = async () => {
    try {
      // Si ya hay instancia corriendo, detenerla primero
      if (html5QrcodeRef.current) {
        try {
          await html5QrcodeRef.current.stop();
          html5QrcodeRef.current.clear();
        } catch (e) {
          // Ignorar error al detener (puede que ya estuviera detenido)
        }
        html5QrcodeRef.current = null;
        const readerDiv = document.getElementById('remote-client-reader');
        if (readerDiv) readerDiv.innerHTML = '';
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrcodeRef.current = new Html5Qrcode('remote-client-reader');

      const config = {
        fps: 30,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const qrboxWidth = Math.floor(viewfinderWidth * 0.95);
          const qrboxHeight = Math.floor(viewfinderHeight * 0.95);
          console.log('📐 QRBox calculado:', { viewfinderWidth, viewfinderHeight, qrboxWidth, qrboxHeight });
          return { width: qrboxWidth, height: qrboxHeight };
        },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        disableFlip: false,
        formatsToSupport: [
          0, // QR_CODE
          8, // CODE_128 (PRIORIDAD)
          15, // ITF
          9, // CODE_39
          13, // EAN_13
          14, // EAN_8
          17, // UPC_A
          18, // UPC_E
          19, // CODE_93
          20, // CODABAR
        ],
        aspectRatio: 1.777,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        videoConstraints: {
          facingMode: 'environment',
          focusMode: 'continuous',
          advanced: [{ zoom: 1.0 }, { focusDistance: 0.5 }]
        }
      };

      console.log('🚀 Iniciando Remote Scanner con config:', config);

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanError
      );

      setIsScanning(true);
      console.log('✅ Remote Client Scanner iniciado exitosamente');

    } catch (error) {
      console.error('❌ Error al iniciar scanner:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Permisos de cámara denegados');
      } else {
        toast.error('Error al iniciar cámara');
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
        setIsScanning(false);
        console.log('⏹️ Remote Client Scanner detenido');
      } catch (error) {
        console.error('Error al detener scanner:', error);
      }
    }
  };

  /**
   * Dibujar marco verde alrededor del código detectado
   */
  const drawDetectionBox = (decodedResult) => {
    const canvas = document.querySelector('#remote-client-reader canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas anterior
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar marco verde
    ctx.strokeStyle = '#22c55e'; // Verde success
    ctx.lineWidth = 4;

    if (decodedResult.result.format?.formatName === 'QR_CODE') {
      // QR Code: dibujar polígono
      const points = decodedResult.result.cornerPoints;
      if (points && points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else {
      // Barcode: dibujar rectángulo
      const box = decodedResult.result.boundingBox;
      if (box) {
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }
    }

    // Limpiar después de 500ms
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 500);
  };

  /**
   * Escaneo exitoso - Enviar al PC
   */
  const onScanSuccess = async (decodedText, decodedResult) => {
    // Prevenir duplicados
    if (scanCooldown.current) {
      console.log('⏭️ Escaneo ignorado (cooldown activo)');
      return;
    }

    if (lastScannedCode.current === decodedText) {
      console.log('⏭️ Código duplicado ignorado');
      return;
    }

    console.log('🔍 Código detectado:', decodedText, decodedResult);

    // 🎯 Dibujar marco verde inmediatamente
    drawDetectionBox(decodedResult);

    // Activar cooldown
    scanCooldown.current = true;
    lastScannedCode.current = decodedText;

    try {
      // Enviar al PC via Realtime
      await remoteScannerService.sendScan(session.id, decodedText, clientId);

      console.log('📤 Código enviado al PC:', decodedText);

      // Feedback visual inmediato (antes de recibir respuesta del PC)
      toast.loading('Procesando en PC...', { id: 'processing' });

      // Vibración inmediata
      vibrate([50]);

      // 🔥 TIMEOUT DE SEGURIDAD: Si no llega feedback en 5s, liberar cooldown
      setTimeout(() => {
        if (scanCooldown.current && lastScannedCode.current === decodedText) {
          console.warn('⚠️ Timeout esperando feedback del PC - liberando cooldown');
          scanCooldown.current = false;
          lastScannedCode.current = null;
          toast.dismiss('processing');
          toast('⏱️ Timeout - listo para siguiente escaneo', { duration: 2000 });
        }
      }, 5000);

    } catch (error) {
      console.error('❌ Error al enviar escaneo:', error);
      toast.error('Error al enviar código', { id: 'processing' });

      // Liberar cooldown en caso de error
      setTimeout(() => {
        scanCooldown.current = false;
        lastScannedCode.current = null;
      }, 500);
    }
  };

  const onScanError = (errorMessage) => {
    // Logging solo para debug (comentar en producción)
    // console.log('🔍 Buscando código...', errorMessage);
  };

  // Sonidos (copiados de ScanGuide.jsx)
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido');
    }
  };

  const playErrorSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.3);
      oscillator.type = 'sawtooth';

      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido');
    }
  };

  const vibrate = (pattern) => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo vibrar');
    }
  };

  const handleClose = () => {
    if (session?.id) {
      remoteScannerService.notifyClientDisconnected(session.id, clientId);
    }
    navigate('/wms');
  };

  // Loading mientras conecta
  if (isConnecting) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">Conectando...</h2>
          <p className="text-white/60 text-sm">Sesión: {sessionCode}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">Error de Conexión</h2>
          <p className="text-white/60 text-sm mb-4">No se pudo conectar a la sesión</p>
          <button
            onClick={() => navigate('/wms')}
            className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // UI Full-Screen (solo cámara + overlays)
  return (
    <div className="fixed inset-0 bg-black">
      {/* Scanner (fondo completo) - SIN clase scanner-container */}
      <div id="remote-client-reader" className="absolute inset-0" />

      {/* Overlay de feedback (cuando se recibe respuesta del PC) */}
      {scanAnimation && (
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          scanAnimation === 'success'
            ? 'bg-green-500/20 border-4 border-green-500'
            : 'bg-red-500/20 border-4 border-red-500'
        }`} />
      )}

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between p-4 bg-dark-950/85 backdrop-blur-xl border-b border-white/10">
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/20 transition-all"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-lg font-bold text-white">Remote Scanner</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-white/60 text-sm">
                {isConnected ? `Conectado a ${sessionCode}` : 'Desconectado'}
              </span>
            </div>
          </div>

          <div className="w-10"></div> {/* Spacer */}
        </div>
      </div>

      {/* Footer overlay - Último feedback */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="p-4 bg-dark-950/85 backdrop-blur-xl border-t border-white/10">
          {lastFeedback ? (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              lastFeedback.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              {lastFeedback.success ? (
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${lastFeedback.success ? 'text-green-400' : 'text-red-400'}`}>
                  {lastFeedback.message}
                </p>
                <p className="text-white/40 text-xs mt-1">
                  {lastFeedback.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-white/60 py-4">
              <p className="text-sm">Escanea una guía para empezar</p>
              <p className="text-xs text-white/40 mt-1">El PC procesará y mostrará el resultado</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default RemoteScannerClient;
