import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { useScanner } from '../hooks/useScanner';
import { ArrowLeft, Camera, CheckCircle2, XCircle, Trash2, Monitor } from 'lucide-react';
import { codesService } from '../services/supabase';
import toast from 'react-hot-toast';

export function ZXingScanner({ onBack }) {
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const readerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(null);
  const lastScannedCode = useRef(null);
  const scanCooldown = useRef(false);
  const [detectionBox, setDetectionBox] = useState(null);

  // Estado para vista de escritorio
  const [isDesktop, setIsDesktop] = useState(false);
  const [todayCodes, setTodayCodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, byCarrier: {}, byStore: {} });
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);

  const { processScan, isProcessing, lastScan, carriers, isLoadingCarriers } = useScanner();

  // Detectar si es desktop (pantalla >= 1024px)
  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Cargar códigos del día y suscribirse a cambios en tiempo real
  useEffect(() => {
    loadTodayCodes();

    // Suscribirse a cambios en tiempo real
    const unsubscribe = codesService.subscribeToChanges(() => {
      loadTodayCodes();
    });

    return () => unsubscribe();
  }, []);

  const loadTodayCodes = async () => {
    try {
      setIsLoadingCodes(true);
      const [codes, statistics] = await Promise.all([
        codesService.getToday(),
        codesService.getTodayStats()
      ]);
      setTodayCodes(codes);
      setStats(statistics);
    } catch (error) {
      console.error('Error cargando códigos del día:', error);
      toast.error('Error cargando códigos');
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const handleDeleteCode = async (id, code) => {
    if (!confirm(`¿Eliminar código ${code}?`)) return;

    try {
      await codesService.delete(id);
      toast.success('Código eliminado');
      loadTodayCodes();
    } catch (error) {
      console.error('Error eliminando código:', error);
      toast.error('Error al eliminar');
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      const codeReader = new BrowserMultiFormatReader();
      readerRef.current = codeReader;

      // Obtener la cámara trasera
      const videoInputDevices = await codeReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('trasera')
      )?.deviceId || videoInputDevices[0]?.deviceId;

      console.log('📷 ZXing Scanner iniciando...');
      console.log('📱 Dispositivos disponibles:', videoInputDevices.length);

      // Iniciar decodificación continua
      await codeReader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const decodedText = result.getText();
            const resultPoints = result.getResultPoints();

            // Dibujar marco adaptativo
            if (resultPoints && resultPoints.length >= 2) {
              drawAdaptiveBox(resultPoints);
            }

            // Procesar código
            onScanSuccess(decodedText);
          } else {
            // Limpiar marco si no hay detección
            if (error && !(error instanceof NotFoundException)) {
              // Solo mostrar errores que NO sean "código no encontrado"
              // console.log('❌ Error menor:', error);
            }
            setDetectionBox(null);
            // Limpiar canvas cuando no hay código
            if (overlayCanvasRef.current) {
              const canvas = overlayCanvasRef.current;
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
      );

      setIsScanning(true);
      console.log('✅ ZXing Scanner iniciado correctamente');
    } catch (error) {
      console.error('❌ Error al iniciar ZXing scanner:', error);
    }
  };

  const stopScanner = () => {
    if (readerRef.current) {
      readerRef.current.reset();
      console.log('⏹️ ZXing Scanner detenido');
    }
    setIsScanning(false);
  };

  const drawAdaptiveBox = (resultPoints) => {
    if (!overlayCanvasRef.current || !videoRef.current) return;

    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    // Obtener dimensiones reales del video y del contenedor
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const displayWidth = video.offsetWidth;
    const displayHeight = video.offsetHeight;

    // Ajustar canvas al tamaño exacto del video renderizado
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calcular bounding box de los puntos de detección
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    resultPoints.forEach(point => {
      if (point) {
        const x = point.getX();
        const y = point.getY();
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    });

    // Calcular el aspect ratio para mantener proporciones correctas
    const videoAspect = videoWidth / videoHeight;
    const displayAspect = displayWidth / displayHeight;

    let scaleX, scaleY, offsetX = 0, offsetY = 0;

    // Determinar si el video tiene letterbox (barras negras) horizontal o vertical
    if (displayAspect > videoAspect) {
      // Video más angosto que el contenedor (barras a los lados)
      scaleY = displayHeight / videoHeight;
      scaleX = scaleY;
      offsetX = (displayWidth - (videoWidth * scaleX)) / 2;
    } else {
      // Video más ancho que el contenedor (barras arriba/abajo)
      scaleX = displayWidth / videoWidth;
      scaleY = scaleX;
      offsetY = (displayHeight - (videoHeight * scaleY)) / 2;
    }

    // Aplicar escala y offset a las coordenadas con padding extra amplio
    const padding = 40; // Padding muy amplio para envolver códigos de barras largos
    const left = Math.max(0, (minX * scaleX) + offsetX - padding);
    const top = Math.max(0, (minY * scaleY) + offsetY - padding);
    const width = Math.min(canvas.width - left, ((maxX - minX) * scaleX) + (padding * 2));
    const height = Math.min(canvas.height - top, ((maxY - minY) * scaleY) + (padding * 2));

    // Guardar estado del marco para React
    setDetectionBox({ left, top, width, height });

    // Dibujar rectángulo ultra fino
    ctx.strokeStyle = 'rgba(0, 217, 192, 1)';
    ctx.lineWidth = 1; // Borde muy fino
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0, 217, 192, 0.4)';
    ctx.strokeRect(left, top, width, height);

    // Dibujar esquinas finas
    const cornerLength = 18; // Esquinas moderadas
    ctx.strokeStyle = 'rgba(0, 217, 192, 1)';
    ctx.lineWidth = 2; // Esquinas delgadas

    // Esquina superior izquierda
    ctx.beginPath();
    ctx.moveTo(left, top + cornerLength);
    ctx.lineTo(left, top);
    ctx.lineTo(left + cornerLength, top);
    ctx.stroke();

    // Esquina superior derecha
    ctx.beginPath();
    ctx.moveTo(left + width - cornerLength, top);
    ctx.lineTo(left + width, top);
    ctx.lineTo(left + width, top + cornerLength);
    ctx.stroke();

    // Esquina inferior izquierda
    ctx.beginPath();
    ctx.moveTo(left, top + height - cornerLength);
    ctx.lineTo(left, top + height);
    ctx.lineTo(left + cornerLength, top + height);
    ctx.stroke();

    // Esquina inferior derecha
    ctx.beginPath();
    ctx.moveTo(left + width - cornerLength, top + height);
    ctx.lineTo(left + width, top + height);
    ctx.lineTo(left + width, top + height - cornerLength);
    ctx.stroke();
  };

  const onScanSuccess = async (decodedText) => {
    if (isProcessing || scanCooldown.current) {
      return;
    }

    if (lastScannedCode.current === decodedText) {
      return;
    }

    console.log('🔍 Código detectado:', decodedText);

    scanCooldown.current = true;
    lastScannedCode.current = decodedText;

    const result = await processScan(decodedText);

    if (result) {
      if (result.isRepeated) {
        setScanAnimation('error');
        playErrorSound();
        vibrate([200, 100, 200]);
      } else {
        setScanAnimation('success');
        playSuccessSound();
        vibrate([100]);
      }

      setTimeout(() => setScanAnimation(null), 2000);
    }

    // Limpiar el marco adaptativo después de 500ms
    setTimeout(() => {
      setDetectionBox(null);
      // Limpiar canvas
      if (overlayCanvasRef.current) {
        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 500);

    setTimeout(() => {
      scanCooldown.current = false;
      lastScannedCode.current = null;
      console.log('✅ Cooldown liberado');
    }, 2000);
  };

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      console.log('🔊 Sonido de ÉXITO');
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido:', error);
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

      console.log('🔊 Sonido de ERROR');
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido:', error);
    }
  };

  const vibrate = (pattern) => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo vibrar:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-800 border-b border-gray-700 p-2">
        <div className={`${isDesktop ? 'max-w-7xl' : 'max-w-4xl'} mx-auto flex items-center justify-between`}>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
          </button>

          <div className="flex items-center gap-2">
            {isDesktop && <Monitor className="w-5 h-5 text-primary-500" />}
            <Camera className="w-4 h-4 text-primary-500" />
            <h1 className="text-lg font-bold text-white">Scanner ZXing</h1>
            {isDesktop && <span className="text-xs text-gray-400 ml-2">Vista Escritorio</span>}
          </div>

          <div className="w-16"></div>
        </div>
      </div>

      {/* Layout adaptativo: Grid en desktop, Stack en mobile */}
      <div className={`${isDesktop ? 'max-w-7xl grid grid-cols-2 gap-4' : 'max-w-4xl'} mx-auto p-2`}>

        {/* Columna izquierda: Scanner */}
        <div className="space-y-2">
          {/* Camera con overlay adaptativo */}
          <div className={`relative bg-dark-800 rounded-2xl overflow-hidden shadow-2xl border-4 transition-all duration-500 ${
            scanAnimation === 'success'
              ? 'border-green-500 shadow-green-500/80 scale-[1.02]'
              : scanAnimation === 'error'
              ? 'border-red-500 shadow-red-500/80 scale-[0.98]'
              : 'border-primary-500/30'
          }`} style={{ maxHeight: '60vh' }}>
            {/* Video */}
            <video
              ref={videoRef}
              className="w-full h-auto"
              style={{ maxHeight: '60vh', objectFit: 'cover' }}
              playsInline
              muted
            />

            {/* Canvas overlay para marco adaptativo */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </div>

          {/* Instrucciones */}
          <div className="bg-dark-800 rounded-xl p-2 border border-gray-700">
            <div className="text-center text-gray-300 text-xs">
              {isLoadingCarriers ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  Cargando transportadoras...
                </div>
              ) : carriers.length === 0 ? (
                <div className="text-red-400">
                  ⚠️ Error: No se cargaron transportadoras.
                </div>
              ) : isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  Procesando código...
                </div>
              ) : (
                <div>
                  <div>✅ {carriers.length} transportadoras listas</div>
                  <div className="mt-1">📷 Apunta la cámara al código QR o de barras</div>
                  <div className="mt-1 text-primary-400 font-semibold">🎯 Marco adaptativo ZXing activado</div>
                </div>
              )}
            </div>
          </div>

          {/* Último escaneo */}
          {lastScan && (
            <div className={`rounded-xl p-3 border-2 ${
              lastScan.isRepeated
                ? 'bg-red-500/10 border-red-500'
                : 'bg-green-500/10 border-green-500'
            }`}>
              <div className="flex items-start gap-3">
                {lastScan.isRepeated ? (
                  <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-mono text-lg font-semibold text-white">
                    {lastScan.code}
                  </p>
                  <p className="text-sm text-gray-300 mt-1">
                    {lastScan.carrier}
                  </p>
                  <p className={`text-sm font-semibold mt-1 ${
                    lastScan.isRepeated ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {lastScan.isRepeated ? '⚠️ REPETIDO (NO GUARDADO)' : '✅ GUARDADO'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: Panel de estadísticas (solo desktop) */}
        {isDesktop && (
          <div className="space-y-4">
            {/* Estadísticas del día */}
            <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-500" />
                Estadísticas del Día
              </h2>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-dark-900 rounded-lg p-3 text-center border border-gray-700">
                  <div className="text-2xl font-bold text-primary-500">{stats.total}</div>
                  <div className="text-xs text-gray-400 mt-1">Total</div>
                </div>

                {Object.entries(stats.byCarrier).map(([carrier, count]) => (
                  <div key={carrier} className="bg-dark-900 rounded-lg p-3 text-center border border-gray-700">
                    <div className="text-2xl font-bold text-green-500">{count}</div>
                    <div className="text-xs text-gray-400 mt-1 capitalize">{carrier}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial en tiempo real */}
            <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
              <h2 className="text-lg font-bold text-white mb-3">Historial del Día</h2>

              {isLoadingCodes ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-400 text-sm mt-2">Cargando...</p>
                </div>
              ) : todayCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No hay códigos escaneados hoy
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {todayCodes.map((code) => (
                    <div
                      key={code.id}
                      className="bg-dark-900 rounded-lg p-3 border border-gray-700 hover:border-primary-500 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-semibold text-white truncate">
                            {code.code}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {code.carrier_display_name || 'Sin transportadora'}
                          </p>
                          {code.store_name && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {code.store_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(code.created_at).toLocaleTimeString('es-CO')}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteCode(code.id, code.code)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg"
                          title="Eliminar código"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
