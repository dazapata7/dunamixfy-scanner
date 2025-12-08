import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useScanner } from '../hooks/useScanner';
import { ArrowLeft, Camera, CheckCircle2, XCircle } from 'lucide-react';
import '../scanner-custom.css'; // V2: CSS personalizado para limitar altura del scanner

export function Scanner({ onBack }) {
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(null); // V2: 'success' | 'error' | null
  const lastScannedCode = useRef(null); // V2: Para evitar escaneos duplicados rápidos
  const scanCooldown = useRef(false); // V2: Cooldown entre escaneos

  // V2: Obtener carriers e isLoadingCarriers para mostrar estado
  const { processScan, isProcessing, lastScan, carriers, isLoadingCarriers } = useScanner();

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
      if (result.isRepeated) {
        // Código repetido: sonido de error + vibración larga + animación roja
        setScanAnimation('error');
        playErrorSound();
        vibrate([200, 100, 200]); // Vibración más larga para error
      } else {
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
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header - V3.3: Más compacto */}
      <div className="bg-dark-800 border-b border-gray-700 p-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
          </button>

          <div className="flex items-center gap-1">
            <Camera className="w-4 h-4 text-primary-500" />
            <h1 className="text-lg font-bold text-white">Scanner</h1>
          </div>

          <div className="w-16"></div>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="max-w-4xl mx-auto p-2">
        <div className="space-y-2">
          {/* Camera */}
          <div className={`bg-dark-800 rounded-2xl overflow-hidden shadow-2xl border-4 transition-all duration-500 ${
            scanAnimation === 'success'
              ? 'border-green-500 shadow-green-500/80 scale-[1.02] animate-pulse-success'
              : scanAnimation === 'error'
              ? 'border-red-500 shadow-red-500/80 scale-[0.98] animate-pulse-error'
              : 'border-primary-500/30'
          }`}>
            <div id="reader" className="w-full"></div>
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
                  ⚠️ Error: No se cargaron transportadoras. Verifica conexión a Supabase.
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
      </div>
    </div>
  );
}
