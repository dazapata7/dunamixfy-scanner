// =====================================================
// SCAN GUIDE - Dunamix WMS
// =====================================================
// Escaneo de guías para despacho
// Reutiliza Scanner.jsx existente + useWMS hook
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWMS } from '../../hooks/useWMS';
import { useStore } from '../../store/useStore';
import { ArrowLeft, CheckCircle2, XCircle, Package, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { DispatchPreview } from './DispatchPreview';
import '../../scanner-custom.css';

export function ScanGuide() {
  const navigate = useNavigate();
  const html5QrcodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(null); // 'success' | 'error' | null
  const lastScannedCode = useRef(null);
  const scanCooldown = useRef(false);

  // WMS Hook
  const { scanGuideForDispatch, confirmDispatch, isProcessing, selectedWarehouse } = useWMS();
  const { operator, operatorId } = useStore();

  // Estado para preview de dispatch
  const [dispatchPreview, setDispatchPreview] = useState(null);
  const [stockValidation, setStockValidation] = useState(null);
  const [shipmentRecord, setShipmentRecord] = useState(null);

  // Contadores de sesión
  const [sessionDispatches, setSessionDispatches] = useState(0);
  const [sessionErrors, setSessionErrors] = useState(0);

  // Verificar que hay almacén seleccionado
  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
    }
  }, [selectedWarehouse, navigate]);

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  // =====================================================
  // SCANNER METHODS (Reutilizados de Scanner.jsx)
  // =====================================================

  const startScanner = async () => {
    try {
      // Dynamic import de html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrcodeRef.current = new Html5Qrcode('wms-reader');
      console.log('📦 WMS Scanner: html5-qrcode cargado');

      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.7);
          return {
            width: qrboxSize,
            height: qrboxSize
          };
        },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        disableFlip: false
      };

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanError
      );

      setIsScanning(true);
      console.log('📷 WMS Scanner iniciado');
    } catch (error) {
      console.error('❌ Error al iniciar WMS scanner:', error);
      toast.error('Error al iniciar cámara');
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
        console.log('⏹️ WMS Scanner detenido');
      } catch (error) {
        console.error('Error al detener scanner:', error);
      }
    }
  };

  // =====================================================
  // SCAN SUCCESS HANDLER (Adaptado para WMS)
  // =====================================================

  const onScanSuccess = async (decodedText) => {
    // Prevenir escaneos duplicados
    if (isProcessing || scanCooldown.current) {
      console.log('⏭️ Escaneo ignorado (procesando o en cooldown)');
      return;
    }

    // Si es el mismo código reciente, ignorar
    if (lastScannedCode.current === decodedText) {
      console.log('⏭️ Código duplicado ignorado');
      return;
    }

    console.log('🔍 WMS: Guía detectada:', decodedText);

    // Activar cooldown
    scanCooldown.current = true;
    lastScannedCode.current = decodedText;

    try {
      // Procesar guía con WMS
      const result = await scanGuideForDispatch(decodedText, operatorId);

      if (result.isDuplicate) {
        // Ya existe dispatch para esta guía
        setScanAnimation('error');
        playErrorSound();
        vibrate([200, 100, 200]);
        toast.error(result.message || 'Guía duplicada');
        setSessionErrors(prev => prev + 1);

      } else {
        // Dispatch creado exitosamente
        setScanAnimation('success');
        playSuccessSound();
        vibrate([100]);
        toast.success('Guía procesada - Revise el despacho');

        // Guardar para preview
        setDispatchPreview(result.dispatch);
        setStockValidation(result.stockValidation);
        setShipmentRecord(result.shipmentRecord);
      }

    } catch (error) {
      console.error('❌ Error al procesar guía:', error);
      setScanAnimation('error');
      playErrorSound();
      vibrate([200, 100, 200, 100, 200]);
      toast.error(error.message || 'Error al procesar la guía');
      setSessionErrors(prev => prev + 1);
    }

    // Limpiar animación
    setTimeout(() => setScanAnimation(null), 2000);

    // Liberar cooldown
    setTimeout(() => {
      scanCooldown.current = false;
      lastScannedCode.current = null;
    }, 2000);
  };

  const onScanError = (error) => {
    // Ignorar errores normales de escaneo
  };

  // =====================================================
  // CONFIRM DISPATCH
  // =====================================================

  const handleConfirmDispatch = async () => {
    try {
      await confirmDispatch(dispatchPreview.id, shipmentRecord?.id);

      // Incrementar contador
      setSessionDispatches(prev => prev + 1);

      // Limpiar preview
      setDispatchPreview(null);
      setStockValidation(null);
      setShipmentRecord(null);

      toast.success('Despacho confirmado exitosamente');

    } catch (error) {
      console.error('❌ Error al confirmar dispatch:', error);
      toast.error(error.message || 'Error al confirmar el despacho');
    }
  };

  // =====================================================
  // CANCEL DISPATCH
  // =====================================================

  const handleCancelDispatch = () => {
    setDispatchPreview(null);
    setStockValidation(null);
    setShipmentRecord(null);
    toast('Despacho cancelado');
  };

  // =====================================================
  // AUDIO & VIBRATION (Reutilizados de Scanner.jsx)
  // =====================================================

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Audio no soportado');
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
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.warn('Audio no soportado');
    }
  };

  const vibrate = (pattern) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  // Si hay preview, mostrar componente de confirmación
  if (dispatchPreview) {
    return (
      <DispatchPreview
        dispatch={dispatchPreview}
        stockValidation={stockValidation}
        onConfirm={handleConfirmDispatch}
        onCancel={handleCancelDispatch}
        isProcessing={isProcessing}
      />
    );
  }

  // Mostrar scanner
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/wms')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="text-white/60 text-sm">
            {selectedWarehouse?.name}
          </div>
        </div>

        {/* Title Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 rounded-2xl bg-white/10">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Escanear Guía
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Despacho de pedidos
              </p>
            </div>
          </div>

          {/* Session Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{sessionDispatches} despachados</span>
            </div>
            {sessionErrors > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-4 h-4" />
                <span>{sessionErrors} errores</span>
              </div>
            )}
          </div>
        </div>

        {/* Scanner Container */}
        <div className="relative bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg overflow-hidden">
          {/* Scanner */}
          <div id="wms-reader" className="rounded-2xl overflow-hidden scanner-container" />

          {/* Scan Animation Ring */}
          {scanAnimation && (
            <div className={`
              absolute inset-0 pointer-events-none
              flex items-center justify-center
            `}>
              <div className={`
                w-32 h-32 rounded-full
                ${scanAnimation === 'success' ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'}
                border-4 animate-ping
              `} />
              <div className="absolute">
                {scanAnimation === 'success' ? (
                  <CheckCircle2 className="w-16 h-16 text-green-400" />
                ) : (
                  <XCircle className="w-16 h-16 text-red-400" />
                )}
              </div>
            </div>
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium">Procesando guía...</p>
                <p className="text-sm text-white/60 mt-2">
                  Validando stock y creando despacho
                </p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/80 text-sm text-center">
              📦 Apunte la cámara al código de barras o QR de la guía
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanGuide;
