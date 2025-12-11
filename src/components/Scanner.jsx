import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
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
      html5QrcodeRef.current = new Html5Qrcode('reader');

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
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header flotante minimalista */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors backdrop-blur-sm bg-black/30 px-3 py-2 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Salir</span>
          </button>

          {/* Contador de sesión flotante */}
          <div className="backdrop-blur-md bg-black/50 px-4 py-2 rounded-full border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 text-white">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-base font-bold">{sessionScans}</span>
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-base font-bold">{sessionRepeated}</span>
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

        {/* Indicador de estado - Flotante arriba */}
        <div className="absolute top-20 left-0 right-0 z-10 px-4">
          {isLoadingCarriers ? (
            <div className="backdrop-blur-md bg-yellow-500/90 text-black px-6 py-3 rounded-full mx-auto w-fit shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold">Cargando transportadoras...</span>
              </div>
            </div>
          ) : carriers.length === 0 ? (
            <div className="backdrop-blur-md bg-red-500/90 text-white px-6 py-3 rounded-full mx-auto w-fit shadow-lg">
              <div className="font-bold">⚠️ Error: Sin transportadoras</div>
            </div>
          ) : isProcessing ? (
            <div className="backdrop-blur-md bg-blue-500/90 text-white px-6 py-3 rounded-full mx-auto w-fit shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold">Procesando...</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Instrucciones - Flotante en el centro */}
        {!isProcessing && !isLoadingCarriers && carriers.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="backdrop-blur-sm bg-black/40 px-6 py-3 rounded-2xl border-2 border-white/30">
              <div className="text-center text-white">
                <div className="text-xl font-bold mb-1">📷 Escanea tu código</div>
                <div className="text-sm opacity-80">{carriers.length} transportadoras listas</div>
              </div>
            </div>
          </div>
        )}

        {/* Último escaneo - Flotante abajo */}
        {lastScan && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className={`backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 ${
              lastScan.isError || lastScan.isRepeated
                ? 'bg-red-500/90 border-red-300'
                : 'bg-green-500/90 border-green-300'
            }`}>
              <div className="flex items-start gap-3">
                {lastScan.isError || lastScan.isRepeated ? (
                  <XCircle className="w-8 h-8 text-white flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-white flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xl font-bold text-white truncate">
                    {lastScan.code}
                  </p>
                  <p className="text-base text-white/90 mt-1 font-medium">
                    {lastScan.carrier}
                  </p>
                  <p className="text-base font-bold mt-1.5 text-white">
                    {lastScan.isError
                      ? `🚫 ${lastScan.errorMessage || 'PEDIDO NO LISTO PARA DESPACHO'}`
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
