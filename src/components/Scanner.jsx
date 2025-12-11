import { useEffect, useRef, useState } from 'react';
// V4: Dynamic import de html5-qrcode (solo cuando se usa Scanner)
// import { Html5Qrcode } from 'html5-qrcode'; // REMOVIDO
import { useScanner } from '../hooks/useScanner';
import { useStore } from '../store/useStore';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import '../scanner-custom.css'; // V2: CSS personalizado para limitar altura del scanner

export function Scanner({ onBack }) {
  const html5QrcodeRef = useRef(null);
  const [scanAnimation, setScanAnimation] = useState(null); // V2: 'success' | 'error' | null
  const lastScannedCode = useRef(null); // V2: Para evitar escaneos duplicados rápidos
  const scanCooldown = useRef(false); // V2: Cooldown entre escaneos

  // V2: Obtener carriers e isLoadingCarriers para mostrar estado
  const { processScan, isProcessing, lastScan, carriers, isLoadingCarriers } = useScanner();

  // Obtener contadores de sesión del store
  const { sessionScans, sessionRepeated } = useStore();

  // V2: Log de depuración para ver estado de carriers
  useEffect(() => {
    console.log('📊 Estado carriers:', {
      isLoadingCarriers,
      carriersCount: carriers?.length,
      carriers: carriers?.map(c => c.display_name)
    });
  }, [carriers, isLoadingCarriers]);

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      // V4: Dynamic import - Cargar html5-qrcode solo cuando se necesita
      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrcodeRef.current = new Html5Qrcode('reader');
      console.log('📦 html5-qrcode cargado dinámicamente');

      // V3.2: Configuración ÓPTIMA - rápida y efectiva
      const config = {
        fps: 10, // V3.2: Volver a 10 FPS (era lo que funcionaba perfecto)
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // V3.2: Marco mediano (70% del área) - balance entre tamaño y detección
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.7);
          return {
            width: qrboxSize,
            height: qrboxSize
          };
        },
        // V3.2: Sin restricción de aspectRatio para permitir expansión completa
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true, // V3.2: Botón de flash si está disponible
        disableFlip: false // V3.2: Permitir flip horizontal si ayuda a detección
      };

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanError
      );

      setIsScanning(true);
      console.log('📷 Scanner iniciado con marco optimizado');
    } catch (error) {
      console.error('Error al iniciar scanner:', error);
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
        console.log('⏹️ Scanner detenido');
      } catch (error) {
        console.error('Error al detener scanner:', error);
      }
    }
  };

  const onScanSuccess = async (decodedText) => {
    // V2: Prevenir escaneos duplicados rápidos
    if (isProcessing || scanCooldown.current) {
      console.log('⏭️ Escaneo ignorado (procesando o en cooldown)');
      return;
    }

    // V2: Si es el mismo código escaneado hace menos de 3 segundos, ignorar
    if (lastScannedCode.current === decodedText) {
      console.log('⏭️ Código duplicado ignorado (mismo código reciente)');
      return;
    }

    console.log('🔍 Código detectado:', decodedText);

    // V2: Activar cooldown INMEDIATAMENTE
    scanCooldown.current = true;
    lastScannedCode.current = decodedText;

    // Procesar el código (SIN pausar el scanner)
    const result = await processScan(decodedText);

    // V2: Feedback sensorial
    if (result) {
      if (result.reason === 'cannot_ship' || result.isRepeated) {
        // Error (pedido no listo o repetido): sonido de error + vibración larga + animación roja
        setScanAnimation('error');
        playErrorSound();
        vibrate([200, 100, 200]); // Vibración más larga para error
      } else if (result.success) {
        // Código guardado: sonido de éxito + vibración corta + animación verde
        setScanAnimation('success');
        playSuccessSound();
        vibrate([100]); // Vibración corta para éxito
      }

      // V2: Limpiar animación después de 2 segundos
      setTimeout(() => setScanAnimation(null), 2000);
    }

    // V2: Liberar cooldown después de 2 segundos
    setTimeout(() => {
      scanCooldown.current = false;
      lastScannedCode.current = null;
      console.log('✅ Cooldown liberado, listo para siguiente escaneo');
    }, 2000);
  };

  const onScanError = (error) => {
    // Ignorar errores de escaneo (son normales cuando no detecta nada)
  };

  // V3.1: Feedback de audio - Beep de éxito (MÁS FUERTE y DISTINTIVO)
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // V3.1: Doble beep ascendente para éxito
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      // V3.1: Volumen MÁS ALTO (0.8 = 80%)
      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      console.log('🔊 Sonido de ÉXITO (verde) - Doble beep ascendente');
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido de éxito:', error);
    }
  };

  // V3.1: Feedback de audio - Beep de error (MÁS FUERTE y MUY DIFERENTE)
  const playErrorSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // V3.1: Triple beep descendente GRAVE para error
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.3);
      oscillator.type = 'sawtooth'; // V3.1: Onda más áspera para error

      // V3.1: Volumen MÁS ALTO (0.8 = 80%)
      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log('🔊 Sonido de ERROR (rojo) - Triple beep descendente');
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido de error:', error);
    }
  };

  // V2: Feedback háptico - Vibración
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
    <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex flex-col">
      {/* Header flotante glassmorphism */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white hover:text-primary-400 transition-all backdrop-blur-xl bg-white/10 px-4 py-2.5 rounded-2xl border border-white/20 shadow-glass hover:bg-white/20 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">Salir</span>
          </button>

          {/* Contador de sesión glassmorphism */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 px-5 py-3 rounded-2xl border border-white/20 shadow-glass-lg">
            <div className="flex items-center gap-4 text-white">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50"></div>
                <span className="text-lg font-bold">{sessionScans}</span>
              </div>
              <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 shadow-lg shadow-red-400/50"></div>
                <span className="text-lg font-bold">{sessionRepeated}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scanner Area - Pantalla completa */}
      <div className="flex-1 relative">
        {/* Camera - Ocupa toda la pantalla */}
        <div className={`absolute inset-0 transition-all duration-300 ${
          scanAnimation === 'success'
            ? 'ring-4 ring-green-500 ring-inset'
            : scanAnimation === 'error'
            ? 'ring-4 ring-red-500 ring-inset'
            : ''
        }`}>
          <div id="reader" className="w-full h-full"></div>
        </div>

        {/* Indicador de estado - Flotante glassmorphism */}
        <div className="absolute top-24 left-0 right-0 z-10 px-4">
          {isLoadingCarriers ? (
            <div className="backdrop-blur-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 text-yellow-100 px-6 py-4 rounded-3xl mx-auto w-fit shadow-glass-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-semibold">Cargando transportadoras...</span>
              </div>
            </div>
          ) : carriers.length === 0 ? (
            <div className="backdrop-blur-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30 text-red-100 px-6 py-4 rounded-3xl mx-auto w-fit shadow-glass-lg">
              <div className="font-semibold">⚠️ Error: Sin transportadoras</div>
            </div>
          ) : isProcessing ? (
            <div className="backdrop-blur-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-cyan-100 px-6 py-4 rounded-3xl mx-auto w-fit shadow-glass-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-semibold">Procesando...</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Instrucciones - Flotante glassmorphism en el centro */}
        {!isProcessing && !isLoadingCarriers && carriers.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 px-8 py-5 rounded-3xl border border-white/20 shadow-glass-lg">
              <div className="text-center text-white">
                <div className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">
                  Escanea tu código
                </div>
                <div className="text-sm text-white/60 font-medium">{carriers.length} transportadoras activas</div>
              </div>
            </div>
          </div>
        )}

        {/* Último escaneo - Flotante glassmorphism abajo */}
        {lastScan && (
          <div className="absolute bottom-6 left-4 right-4 z-10">
            <div className={`backdrop-blur-2xl rounded-3xl p-6 shadow-glass-lg border transition-all duration-300 ${
              lastScan.isError || lastScan.isRepeated
                ? 'bg-gradient-to-br from-red-500/20 to-pink-500/20 border-red-400/30'
                : 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/30'
            }`}>
              <div className="flex items-start gap-4">
                {lastScan.isError || lastScan.isRepeated ? (
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-7 h-7 text-red-400" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-green-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xl font-bold text-white truncate mb-1.5">
                    {lastScan.code}
                  </p>
                  <p className="text-base text-white/80 font-medium mb-2">
                    {lastScan.carrier}
                  </p>
                  <p className={`text-sm font-bold px-3 py-1.5 rounded-xl inline-block ${
                    lastScan.isError || lastScan.isRepeated
                      ? 'bg-red-500/30 text-red-100'
                      : 'bg-green-500/30 text-green-100'
                  }`}>
                    {lastScan.isError
                      ? `🚫 ${lastScan.errorMessage || 'PEDIDO NO LISTO'}`
                      : lastScan.isRepeated
                        ? '⚠️ REPETIDO - NO GUARDADO'
                        : '✅ GUARDADO EXITOSAMENTE'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
