import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { useScanner } from '../hooks/useScanner';
import { ArrowLeft, Camera, CheckCircle2, XCircle } from 'lucide-react';

export function ZXingScanner({ onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const readerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(null);
  const lastScannedCode = useRef(null);
  const scanCooldown = useRef(false);
  const [detectionBox, setDetectionBox] = useState(null);

  const { processScan, isProcessing, lastScan, carriers, isLoadingCarriers } = useScanner();

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      readerRef.current = new BrowserMultiFormatReader();

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const backCamera = videoDevices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('trasera')
      ) || videoDevices[videoDevices.length - 1];

      const constraints = {
        video: {
          deviceId: backCamera?.deviceId,
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);

        // Iniciar el loop de detección
        requestAnimationFrame(detectCode);

        console.log('📷 ZXing Scanner iniciado con cámara:', backCamera?.label || 'Default');
      }
    } catch (error) {
      console.error('❌ Error al iniciar ZXing scanner:', error);
    }
  };

  const stopScanner = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    console.log('⏹️ ZXing Scanner detenido');
  };

  const detectCode = async () => {
    if (!isScanning || !videoRef.current || !canvasRef.current || scanCooldown.current) {
      animationFrameRef.current = requestAnimationFrame(detectCode);
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    // Ajustar canvas al tamaño del video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Dibujar el frame actual del video en el canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = await readerRef.current.decodeFromImageData(imageData);

      if (result) {
        const decodedText = result.getText();
        const resultPoints = result.getResultPoints();

        // Dibujar marco adaptativo
        if (resultPoints && resultPoints.length >= 2) {
          drawAdaptiveBox(resultPoints);
        }

        // Procesar el código
        await onScanSuccess(decodedText);
      } else {
        // No se detectó código, limpiar marco
        setDetectionBox(null);
      }
    } catch (error) {
      // Error normal cuando no hay código en el frame
      setDetectionBox(null);
    }

    animationFrameRef.current = requestAnimationFrame(detectCode);
  };

  const drawAdaptiveBox = (resultPoints) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Calcular bounding box a partir de los puntos de detección
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    resultPoints.forEach(point => {
      if (point) {
        minX = Math.min(minX, point.getX());
        minY = Math.min(minY, point.getY());
        maxX = Math.max(maxX, point.getX());
        maxY = Math.max(maxY, point.getY());
      }
    });

    // Añadir padding al marco
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);

    // Convertir coordenadas del canvas a coordenadas del video mostrado
    const scaleX = video.offsetWidth / canvas.width;
    const scaleY = video.offsetHeight / canvas.height;

    setDetectionBox({
      left: minX * scaleX,
      top: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY
    });
  };

  const onScanSuccess = async (decodedText) => {
    if (isProcessing || scanCooldown.current) {
      console.log('⏭️ Escaneo ignorado (procesando o en cooldown)');
      return;
    }

    if (lastScannedCode.current === decodedText) {
      console.log('⏭️ Código duplicado ignorado');
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

    setTimeout(() => {
      scanCooldown.current = false;
      lastScannedCode.current = null;
      setDetectionBox(null);
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
            <h1 className="text-lg font-bold text-white">Scanner ZXing</h1>
          </div>

          <div className="w-16"></div>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="max-w-4xl mx-auto p-2">
        <div className="space-y-2">
          {/* Camera con overlay adaptativo */}
          <div className={`relative bg-dark-800 rounded-2xl overflow-hidden shadow-2xl border-4 transition-all duration-500 ${
            scanAnimation === 'success'
              ? 'border-green-500 shadow-green-500/80 scale-[1.02]'
              : scanAnimation === 'error'
              ? 'border-red-500 shadow-red-500/80 scale-[0.98]'
              : 'border-primary-500/30'
          }`}>
            {/* Video */}
            <video
              ref={videoRef}
              className="w-full h-auto"
              playsInline
              muted
            />

            {/* Canvas oculto para procesamiento */}
            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Marco adaptativo que se ajusta al código detectado */}
            {detectionBox && (
              <div
                className="absolute border-4 border-primary-500 rounded-lg transition-all duration-100"
                style={{
                  left: `${detectionBox.left}px`,
                  top: `${detectionBox.top}px`,
                  width: `${detectionBox.width}px`,
                  height: `${detectionBox.height}px`,
                  boxShadow: '0 0 20px rgba(0, 217, 192, 0.8), inset 0 0 10px rgba(0, 217, 192, 0.3)'
                }}
              >
                {/* Esquinas del marco */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary-400 rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary-400 rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary-400 rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary-400 rounded-br-lg"></div>
              </div>
            )}
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
                  <div className="mt-1 text-primary-400">Marco adaptativo activado</div>
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
