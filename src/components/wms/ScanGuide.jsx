// =====================================================
// SCAN GUIDE - Dunamix WMS
// =====================================================
// Escaneo de guías para despacho
// BASADO EN Scanner.jsx (3 meses de desarrollo)
// =====================================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWMS } from '../../hooks/useWMS';
import { useScannerCache } from '../../hooks/useScannerCache';
import { inventoryService } from '../../services/wmsService';
import { useStore } from '../../store/useStore';
import { ArrowLeft, CheckCircle2, XCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { DispatchPreview } from './DispatchPreview';
import { BatchSummary } from './BatchSummary';
import '../../scanner-custom.css';

export function ScanGuide() {
  const navigate = useNavigate();
  const html5QrcodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(null); // 'success' | 'error' | null
  const lastScannedCode = useRef(null);
  const scanCooldown = useRef(false);

  const { operator, operatorId, selectedWarehouse } = useStore();

  // ⚡ Scanner Cache Hook - Precarga productos/stock para validaciones rápidas
  const {
    isLoading: isCacheLoading,
    findProductBySku,
    hasStock,
    getStock,
    updateStockLocal,
    refresh: refreshCache
  } = useScannerCache(selectedWarehouse?.id);

  // WMS Hook - ⚡ PASAR FUNCIONES DE CACHE para búsqueda O(1)
  const { scanGuideForDispatch, confirmDispatch, isProcessing, loadTodayDispatchesCache } = useWMS({
    findProductBySku,
    hasStock,
    getStock
  });

  // DEBUG: Verificar operatorId
  useEffect(() => {
    console.log('🧑 Operador actual:', { operator, operatorId });
    if (!operatorId) {
      console.error('❌ NO HAY OPERADOR - Debe hacer login primero');
    }
  }, [operator, operatorId]);

  // Estado para batch de dispatches (múltiples escaneos antes de confirmar)
  const [dispatchesBatch, setDispatchesBatch] = useState([]); // Array de dispatches pendientes
  const [showBatchSummary, setShowBatchSummary] = useState(false); // Mostrar resumen

  // Transportadora bloqueada para este batch (primera transportadora escaneada)
  const [batchCarrier, setBatchCarrier] = useState(null); // { id, name, code }

  // Contadores de sesión
  const [sessionSuccess, setSessionSuccess] = useState(0);
  const [sessionErrors, setSessionErrors] = useState(0);

  // Último escaneo (para feedback visual como Scanner.jsx)
  const [lastScan, setLastScan] = useState(null);

  // Progreso de confirmación (para overlay de progreso)
  const [confirmProgress, setConfirmProgress] = useState(null); // null | { current, total, currentCode }
  const [isConfirming, setIsConfirming] = useState(false);

  // Calcular estadísticas del batch por categoría
  const batchStats = {
    success: dispatchesBatch.filter(item => item.category === 'SUCCESS').length,
    repeatedToday: dispatchesBatch.filter(item => item.category === 'REPEATED_TODAY').length,
    repeatedOtherDay: dispatchesBatch.filter(item => item.category === 'REPEATED_OTHER_DAY').length,
    draftDuplicate: dispatchesBatch.filter(item => item.category === 'DRAFT_DUPLICATE').length,
    alreadyScanned: dispatchesBatch.filter(item => item.category === 'ALREADY_SCANNED_EXTERNAL').length,
    errorNotReady: dispatchesBatch.filter(item => item.category === 'ERROR_NOT_READY').length,
    errorNotFound: dispatchesBatch.filter(item => item.category === 'ERROR_NOT_FOUND').length,
    errorOther: dispatchesBatch.filter(item => item.category === 'ERROR_OTHER').length,
    total: dispatchesBatch.length,
    confirmable: dispatchesBatch.filter(item => item.category === 'SUCCESS').length
  };

  // Si no hay operador, redirigir al login (con pequeño delay para que Zustand cargue del localStorage)
  useEffect(() => {
    // Dar tiempo a Zustand para cargar desde localStorage
    const timer = setTimeout(() => {
      if (!operatorId) {
        console.log('⚠️ No hay operador - redirigiendo al login...');
        toast.error('Debe hacer login primero');
        navigate('/');
      }
    }, 100); // 100ms es suficiente para que Zustand restaure el estado

    return () => clearTimeout(timer);
  }, [operatorId, navigate]);

  // Si no hay almacén, redirigir al selector ANTES de pedir permisos (con pequeño delay)
  useEffect(() => {
    // Dar tiempo a Zustand para cargar desde localStorage
    const timer = setTimeout(() => {
      if (!selectedWarehouse) {
        console.log('⚠️ No hay almacén seleccionado - redirigiendo...');
        navigate('/wms/select-warehouse?redirect=/wms/scan-guide');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedWarehouse, navigate]);

  // Cargar cache de dispatches del día al iniciar
  useEffect(() => {
    if (!selectedWarehouse) return;

    // Cargar dispatches del día en cache para validación rápida
    console.log('🔄 Cargando cache de dispatches del día...');
    loadTodayDispatchesCache(selectedWarehouse.id);
  }, [selectedWarehouse]);

  // Inicializar scanner solo si hay operador, almacén Y cache terminó de cargar
  // isCacheLoading: mientras es true, el DOM muestra loading screen (sin #wms-reader)
  // Solo cuando isCacheLoading=false el div #wms-reader existe en el DOM
  useEffect(() => {
    if (!operatorId || !selectedWarehouse || isCacheLoading) {
      return;
    }

    // Pequeño delay para asegurar que React haya pintado el div en el DOM
    const timer = setTimeout(() => {
      const readerDiv = document.getElementById('wms-reader');
      if (!readerDiv) {
        console.error('❌ #wms-reader no existe en el DOM todavía');
        return;
      }
      console.log('✅ Almacén seleccionado, iniciando scanner...');
      startScanner();
    }, 50);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [operatorId, selectedWarehouse, isCacheLoading]);

  // =====================================================
  // SCANNER METHODS (Copiados de Scanner.jsx)
  // =====================================================

  const startScanner = async () => {
    try {
      // Si ya hay instancia corriendo, detenerla primero
      if (html5QrcodeRef.current) {
        console.log('⚠️ Scanner ya existe, limpiando antes de reiniciar...');
        try {
          await html5QrcodeRef.current.stop();
          html5QrcodeRef.current.clear();
        } catch (e) {
          // Ignorar error al detener (puede que ya estuviera detenido)
        }
        html5QrcodeRef.current = null;
        // Limpiar el div manualmente para evitar contenido residual
        const readerDiv = document.getElementById('wms-reader');
        if (readerDiv) readerDiv.innerHTML = '';
      }

      // Dynamic import de html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrcodeRef.current = new Html5Qrcode('wms-reader');
      console.log('📦 WMS Scanner: html5-qrcode cargado');

      // Configuración ÓPTIMA para QR + Código de Barras con DETECCIÓN RÁPIDA
      const config = {
        fps: 30, // Aumentado de 10 a 30 para detección MÁS RÁPIDA
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // 🔥 CAMBIO: Usar el 95% para MAXIMIZAR detección de barcodes largos (Interrápidisimo)
          const qrboxWidth = Math.floor(viewfinderWidth * 0.95);
          const qrboxHeight = Math.floor(viewfinderHeight * 0.95);
          return {
            width: qrboxWidth,
            height: qrboxHeight
          };
        },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        disableFlip: false, // 🔥 ACTIVAR flip para mejorar detección de barcodes largos (Interrápidisimo)
        // Soporte explícito para múltiples formatos de códigos
        formatsToSupport: [
          // QR Code
          0, // QR_CODE
          // Códigos de barras 1D (PRIORIZAR CODE_128 primero)
          8, // CODE_128 (usado por muchas transportadoras) - PRIMERO
          15, // ITF (Interleaved 2 of 5) - SEGUNDO
          9, // CODE_39
          13, // EAN_13 (estándar retail)
          14, // EAN_8
          17, // UPC_A
          18, // UPC_E
          19, // CODE_93
          20, // CODABAR
        ],
        // Mejorar detección de códigos de barras
        aspectRatio: 1.777, // 16:9 ratio - MEJOR para barcodes horizontales
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Usar API nativa del navegador si está disponible
        },
        // NUEVO: Configuración avanzada para barcodes
        videoConstraints: {
          facingMode: 'environment',
          focusMode: 'continuous', // Autofocus continuo
          advanced: [
            { zoom: 1.0 },
            { focusDistance: 0.5 }
          ]
        }
      };

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanError
      );

      setIsScanning(true);
      console.log('📷 WMS Scanner iniciado con marco optimizado');
    } catch (error) {
      console.error('❌ Error al iniciar WMS scanner:', error);

      if (error.name === 'NotAllowedError') {
        toast.error('❌ Permisos de cámara denegados\nActiva el acceso a la cámara en tu navegador');
      } else if (error.name === 'NotFoundError') {
        toast.error('❌ No se encontró cámara\nVerifica que el dispositivo tiene cámara');
      } else if (error.message?.includes('Camera not found')) {
        toast.error('❌ Cámara no disponible\nOtra app puede estar usándola');
      } else {
        toast.error(`❌ Error al abrir cámara: ${error.message || 'Error desconocido'}`);
      }
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
  // DETECTION BOX DRAWING (Marco verde alrededor del código)
  // =====================================================

  const drawDetectionBox = (decodedResult) => {
    try {
      console.log('🎨 Intentando dibujar marco de detección...', decodedResult);

      // Buscar el canvas del scanner
      const canvas = document.querySelector('#wms-reader canvas');
      if (!canvas) {
        console.warn('⚠️ Canvas no encontrado');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('⚠️ Contexto 2D no disponible');
        return;
      }

      // Html5Qrcode puede retornar la estructura de diferentes formas
      // Intentar obtener los puntos de varias maneras
      let points = null;

      if (decodedResult.result?.resultPoints) {
        points = decodedResult.result.resultPoints;
      } else if (decodedResult.resultPoints) {
        points = decodedResult.resultPoints;
      }

      console.log('📍 Puntos detectados:', points);

      // Si no hay puntos, dibujar un marco general en el centro
      if (!points || points.length === 0) {
        console.log('⚠️ Sin puntos específicos, dibujando marco general');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const boxWidth = Math.min(canvas.width, canvas.height) * 0.6;
        const boxHeight = boxWidth * 0.3;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 20;
        ctx.strokeRect(
          centerX - boxWidth / 2,
          centerY - boxHeight / 2,
          boxWidth,
          boxHeight
        );

        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 1000);
        return;
      }

      // Limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dibujar marco verde alrededor del código
      ctx.strokeStyle = '#10b981'; // Verde (green-500)
      ctx.lineWidth = 6; // Más grueso para mayor visibilidad
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 20; // Más glow

      // Determinar si es QR (4+ puntos) o barcode (2 puntos típicamente)
      if (points.length >= 4) {
        console.log('✅ Dibujando QR Code (polígono)');
        // QR Code - Dibujar polígono
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (points.length >= 2) {
        console.log('✅ Dibujando Barcode (rectángulo)');
        // Barcode - Dibujar rectángulo extendido verticalmente
        const x1 = Math.min(points[0].x, points[1].x);
        const x2 = Math.max(points[0].x, points[1].x);
        const y1 = points[0].y;
        const y2 = points[1].y;
        const height = Math.abs(y2 - y1) || 80; // Altura mínima 80px
        const width = x2 - x1;

        // Expandir el rectángulo para que sea más visible
        const expandY = Math.max(height * 3, 100); // Expandir 3x verticalmente, mínimo 100px
        const centerY = (y1 + y2) / 2;

        ctx.strokeRect(
          x1 - 20, // Padding izquierdo
          centerY - expandY / 2,
          width + 40, // Padding derecho
          expandY
        );
      }

      // Limpiar después de 1 segundo
      setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 1000);

    } catch (error) {
      console.error('❌ Error al dibujar marco de detección:', error);
    }
  };

  // =====================================================
  // SCAN SUCCESS HANDLER (Adaptado para WMS)
  // =====================================================

  const onScanSuccess = async (decodedText, decodedResult) => {
    // Prevenir escaneos duplicados - solo cooldown, NO isProcessing
    // isProcessing bloquearía el scanner 800ms-2s durante llamada a Dunamixfy API
    if (scanCooldown.current) {
      console.log('⏭️ Escaneo ignorado (en cooldown)');
      return;
    }

    // Si es el mismo código reciente, ignorar
    if (lastScannedCode.current === decodedText) {
      console.log('⏭️ Código duplicado ignorado (mismo código reciente)');
      return;
    }

    console.log('🔍 WMS: Guía detectada:', decodedText);
    console.log('📦 Resultado completo:', decodedResult);

    // Dibujar marco verde alrededor del código detectado SIEMPRE
    drawDetectionBox(decodedResult);

    // Activar cooldown INMEDIATAMENTE
    scanCooldown.current = true;
    lastScannedCode.current = decodedText;

    try {
      // Procesar guía con WMS (ahora retorna categoría en lugar de fallar)
      const result = await scanGuideForDispatch(decodedText, operatorId);

      console.log('📊 Categoría de guía:', result.category);
      console.log('🚚 Transportadora detectada:', result.carrierInfo);

      // 🔒 VALIDAR TRANSPORTADORA DEL BATCH
      // Si ya hay una transportadora bloqueada, verificar que coincida
      if (batchCarrier) {
        if (result.carrierInfo && result.carrierInfo.id !== batchCarrier.id) {
          // ❌ Transportadora diferente - RECHAZAR
          setScanAnimation('error');
          playErrorSound();
          vibrate([200, 100, 200]);
          toast.error(
            `❌ Este batch es solo para ${batchCarrier.name}\n` +
            `Escaneaste una guía de ${result.carrierInfo.name}`,
            { duration: 5000 }
          );
          setSessionErrors(prev => prev + 1);

          setLastScan({
            code: decodedText,
            carrier: result.carrierInfo.name,
            category: 'ERROR_OTHER',
            message: `Este batch es solo para ${batchCarrier.name}`,
            isRepeated: false,
            isError: true
          });

          // ⚠️ IMPORTANTE: Liberar cooldown ANTES de return
          setTimeout(() => {
            scanCooldown.current = false;
            lastScannedCode.current = null;
            setScanAnimation(null);
            console.log('✅ Cooldown liberado después de rechazo por transportadora');
          }, 500);

          // NO agregar al batch
          return;
        }
      } else if (result.carrierInfo) {
        // Primera guía del batch - BLOQUEAR a esta transportadora
        console.log(`🔒 Batch bloqueado a: ${result.carrierInfo.name}`);
        setBatchCarrier(result.carrierInfo);
      }

      // Clasificar según categoría
      const category = result.category || 'SUCCESS';

      // SIEMPRE agregar al batch (nuevas + repetidas + errores)
      setDispatchesBatch(prev => [...prev, {
        ...result,
        category,
        scannedAt: new Date()
      }]);

      // Feedback visual y sonoro según categoría
      switch (category) {
        case 'SUCCESS':
          // ✅ Guía nueva procesada exitosamente
          setScanAnimation('success');
          playSuccessSound();
          vibrate([100]);
          toast.success(`✅ Nueva: ${result.dispatch.dispatch_number}`);
          setSessionSuccess(prev => prev + 1);

          setLastScan({
            code: result.feedbackInfo.code,
            carrier: result.feedbackInfo.carrier,
            customerName: result.feedbackInfo.customerName,
            orderId: result.feedbackInfo.orderId,
            storeName: result.feedbackInfo.storeName,
            itemsCount: result.feedbackInfo.itemsCount,
            category: 'SUCCESS',
            isRepeated: false,
            isError: false
          });
          break;

        case 'REPEATED_TODAY':
          // ⚠️ Guía repetida de hoy
          setScanAnimation('error');
          playErrorSound();
          vibrate([200, 100]);
          toast.error(`⚠️ Repetida HOY - ${result.message}`, { duration: 4000 });
          setSessionErrors(prev => prev + 1);

          setLastScan({
            code: result.feedbackInfo.code,
            carrier: result.feedbackInfo.carrier,
            category: 'REPEATED_TODAY',
            message: result.message,
            isRepeated: true,
            isError: false
          });
          break;

        case 'REPEATED_OTHER_DAY':
          // 📅 Guía repetida de otro día
          setScanAnimation('error');
          playErrorSound();
          vibrate([200, 100]);
          toast.error(`📅 Repetida - ${result.message}`, { duration: 4000 });
          setSessionErrors(prev => prev + 1);

          setLastScan({
            code: result.feedbackInfo.code,
            carrier: result.feedbackInfo.carrier,
            category: 'REPEATED_OTHER_DAY',
            message: result.message,
            isRepeated: true,
            isError: false
          });
          break;

        case 'DRAFT_DUPLICATE':
          // 📝 Guía con dispatch en borrador
          setScanAnimation('error');
          playErrorSound();
          vibrate([200]);
          toast.error(`📝 ${result.message}`, { duration: 3000 });
          setSessionErrors(prev => prev + 1);

          setLastScan({
            code: result.feedbackInfo.code,
            carrier: result.feedbackInfo.carrier,
            category: 'DRAFT_DUPLICATE',
            isRepeated: true,
            isError: false
          });
          break;

        case 'ALREADY_SCANNED_EXTERNAL':
          // 🔄 Ya escaneada en Dunamixfy
          setScanAnimation('error');
          playErrorSound();
          vibrate([200, 100]);
          toast.error(`🔄 ${result.message}`, { duration: 4000 });
          setSessionErrors(prev => prev + 1);

          setLastScan({
            code: result.feedbackInfo.code,
            carrier: result.feedbackInfo.carrier,
            category: 'ALREADY_SCANNED_EXTERNAL',
            message: result.message,
            isRepeated: false,
            isError: true
          });
          break;

        case 'ERROR_NOT_READY':
        case 'ERROR_NOT_FOUND':
        case 'ERROR_OTHER':
          // ❌ Errores diversos
          setScanAnimation('error');
          playErrorSound();
          vibrate([200, 100, 200]);
          toast.error(`❌ ${result.message}`, { duration: 5000 });
          setSessionErrors(prev => prev + 1);

          setLastScan({
            code: result.feedbackInfo.code,
            carrier: result.feedbackInfo.carrier,
            category,
            message: result.message,
            isRepeated: false,
            isError: true
          });
          break;

        default:
          console.warn('⚠️ Categoría desconocida:', category);
          break;
      }

    } catch (error) {
      console.error('❌ Error al procesar guía:', error);
      setScanAnimation('error');
      playErrorSound();
      vibrate([200, 100, 200, 100, 200]);

      // Mostrar toast con error completo
      toast.error(error.message || 'Error al procesar la guía', {
        duration: 6000,
        style: {
          maxWidth: '500px'
        }
      });

      setSessionErrors(prev => prev + 1);

      // Actualizar lastScan para feedback visual (ERROR)
      // Detectar si es error de transportadora no identificada
      const isCarrierNotFound = error.message?.includes('TRANSPORTADORA NO IDENTIFICADA');

      setLastScan({
        code: decodedText,
        carrier: isCarrierNotFound ? '⚠️ NO IDENTIFICADA' : 'Error',
        isRepeated: false,
        isError: true,
        errorMessage: error.message || 'Error al procesar la guía'
      });
    }

    // Limpiar animación después de 1.5 segundos
    setTimeout(() => setScanAnimation(null), 1500);

    // Cooldown de 800ms mínimo entre escaneos
    setTimeout(() => {
      scanCooldown.current = false;
      lastScannedCode.current = null;
      console.log('✅ Cooldown liberado, listo para siguiente escaneo');
    }, 800);
  };

  const onScanError = (error) => {
    // Ignorar errores normales de escaneo
  };

  // =====================================================
  // AUDIO & VIBRATION (Copiados EXACTAMENTE de Scanner.jsx)
  // =====================================================

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Doble beep ascendente para éxito
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      // Volumen MÁS ALTO (0.8 = 80%)
      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      console.log('🔊 Sonido de ÉXITO (verde) - Doble beep ascendente');
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido de éxito:', error);
    }
  };

  const playErrorSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Triple beep descendente GRAVE para error
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.3);
      oscillator.type = 'sawtooth'; // Onda más áspera para error

      // Volumen MÁS ALTO (0.8 = 80%)
      gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log('🔊 Sonido de ERROR (rojo) - Triple beep descendente');
    } catch (error) {
      console.warn('⚠️ No se pudo reproducir sonido de error:', error);
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

  // =====================================================
  // BATCH ACTIONS
  // =====================================================

  const handleFinishScanning = () => {
    if (dispatchesBatch.length === 0) {
      toast.error('No hay guías escaneadas para aprobar');
      return;
    }

    // Detener scanner y mostrar resumen
    stopScanner();
    setShowBatchSummary(true);
  };

  const handleConfirmBatch = async () => {
    // Solo confirmar guías SUCCESS (nuevas)
    const successItems = dispatchesBatch.filter(item => item.category === 'SUCCESS');
    const omittedItems = dispatchesBatch.length - successItems.length;

    if (successItems.length === 0) {
      toast.error('No hay guías nuevas para confirmar');
      return;
    }

    setIsConfirming(true);
    setConfirmProgress({ current: 0, total: successItems.length, currentCode: null });

    try {
      console.log(`📦 Confirmando ${successItems.length} guías nuevas (${omittedItems} omitidas)...`);

      // ⭐ PRE-VALIDACIÓN DE STOCK PARA TODO EL BATCH
      const allBatchItems = successItems.flatMap(item =>
        (item.dispatch?.items || []).map(i => ({
          product_id: i.product_id,
          sku: i.sku,
          qty: i.qty
        }))
      );

      if (allBatchItems.length > 0 && allBatchItems.some(i => i.product_id)) {
        console.log(`🔍 Pre-validando stock para ${allBatchItems.length} items del batch...`);
        const batchValidation = await inventoryService.validateBatchStock(
          selectedWarehouse.id,
          allBatchItems
        );

        if (!batchValidation.valid) {
          const insufficientItems = batchValidation.results
            .filter(r => r.insufficient)
            .map(r => `${r.sku || r.product_id} (necesita ${r.requested}, hay ${r.available})`)
            .join(', ');
          toast.error(`Stock insuficiente para el batch:\n${insufficientItems}`, { duration: 8000 });
          return;
        }
        console.log('✅ Stock suficiente para todo el batch - confirmando...');
      }

      // Confirmar cada guía individualmente con progreso visible
      let confirmed = 0;
      const errors = [];

      for (let i = 0; i < successItems.length; i++) {
        const item = successItems[i];
        const guideCode = item.dispatch?.guide_code || 'desconocida';

        // Actualizar progreso
        setConfirmProgress({ current: i + 1, total: successItems.length, currentCode: guideCode });

        try {
          console.log(`🔄 Confirmando guía ${guideCode} (${i + 1}/${successItems.length})...`);
          await confirmDispatch(item.dispatch, item.shipmentRecord?.id, { skipStockValidation: true });
          confirmed++;
          console.log(`✅ Dispatch ${confirmed}/${successItems.length} confirmado: ${guideCode}`);
        } catch (itemError) {
          console.error(`❌ Error confirmando guía ${guideCode}:`, itemError.message, itemError);
          errors.push(guideCode);
        }
      }

      // Mostrar resultado
      if (confirmed > 0 && errors.length === 0) {
        const msg = `✅ ${confirmed} despacho${confirmed > 1 ? 's' : ''} confirmado${confirmed > 1 ? 's' : ''}`;
        const omitMsg = omittedItems > 0 ? ` | ⚠️ ${omittedItems} omitida${omittedItems > 1 ? 's' : ''}` : '';
        toast.success(msg + omitMsg, { duration: 5000 });
      } else if (confirmed > 0 && errors.length > 0) {
        console.error('❌ Guías con error al confirmar:', errors);
        toast(`⚠️ ${confirmed} confirmadas | ❌ ${errors.length} fallaron:\n${errors.join(', ')}`, { duration: 8000 });
      } else {
        toast.error(`❌ No se pudo confirmar ningún despacho`);
        return;
      }

      // Refrescar cache
      console.log('🔄 Refrescando cache de productos/stock...');
      await refreshCache();

      // Limpiar y navegar
      setDispatchesBatch([]);
      setShowBatchSummary(false);
      navigate('/wms');

    } catch (error) {
      console.error('❌ Error al confirmar batch:', error);
      toast.error(error.message || 'Error al confirmar los despachos');
    } finally {
      setIsConfirming(false);
      setConfirmProgress(null);
    }
  };

  const handleCancelBatch = () => {
    // Volver a escanear (reiniciar scanner)
    setShowBatchSummary(false);
    setDispatchesBatch([]);
    startScanner();
    toast('Batch cancelado - Puede continuar escaneando');
  };

  // =====================================================
  // RENDER
  // =====================================================

  // ⚡ Mostrar loading mientras cache se carga
  if (isCacheLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">⚡ Optimizando Scanner...</h2>
          <p className="text-white/60 text-sm">Cargando productos y stock en memoria</p>
          <p className="text-white/40 text-xs mt-2">Esto solo toma unos segundos y hace que el escaneo sea ultra rápido</p>
        </div>
      </div>
    );
  }

  // Si está mostrando resumen del batch, usar componente BatchSummary
  if (showBatchSummary) {
    return (
      <BatchSummary
        batch={dispatchesBatch}
        stats={batchStats}
        onConfirm={handleConfirmBatch}
        onCancel={handleCancelBatch}
        isProcessing={isConfirming}
        confirmProgress={confirmProgress}
      />
    );
  }

  // Código antiguo de resumen inline removido - ahora usamos BatchSummary component

  // NUEVO: Handler para cerrar scanner (botón X)
  const handleCloseScanner = () => {
    if (dispatchesBatch.length > 0) {
      // Recalcular stats con el batch actual (evita closure con valores antiguos)
      const currentStats = {
        success: dispatchesBatch.filter(item => item.category === 'SUCCESS').length,
        repeatedToday: dispatchesBatch.filter(item => item.category === 'REPEATED_TODAY').length,
        repeatedOtherDay: dispatchesBatch.filter(item => item.category === 'REPEATED_OTHER_DAY').length,
        draftDuplicate: dispatchesBatch.filter(item => item.category === 'DRAFT_DUPLICATE').length,
        alreadyScanned: dispatchesBatch.filter(item => item.category === 'ALREADY_SCANNED_EXTERNAL').length,
        errorNotReady: dispatchesBatch.filter(item => item.category === 'ERROR_NOT_READY').length,
        errorNotFound: dispatchesBatch.filter(item => item.category === 'ERROR_NOT_FOUND').length,
        errorOther: dispatchesBatch.filter(item => item.category === 'ERROR_OTHER').length,
        total: dispatchesBatch.length,
        confirmable: dispatchesBatch.filter(item => item.category === 'SUCCESS').length
      };

      // Guardar en sessionStorage y navegar a resumen
      sessionStorage.setItem('wms_batch', JSON.stringify({
        dispatches: dispatchesBatch,
        stats: currentStats,
        warehouse: selectedWarehouse
      }));

      console.log('📦 Batch guardado en sessionStorage:', {
        totalGuides: dispatchesBatch.length,
        confirmable: currentStats.confirmable,
        stats: currentStats
      });

      navigate('/wms/batch-summary');
    } else {
      // Si no hay guías, volver a WMS Home
      navigate('/wms');
    }
  };

  // Mostrar scanner (UI FULL-SCREEN con overlays)
  return (
    <div className="fixed inset-0 bg-black">
      {/* Scanner (fondo completo) - SIN clase scanner-container */}
      <div id="wms-reader" className="absolute inset-0" />

      {/* Header overlay (semi-transparente) */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between p-4 bg-dark-950/85 backdrop-blur-xl border-b border-white/10">
          <button
            onClick={handleCloseScanner}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/20 transition-all"
            aria-label="Cerrar scanner"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white">
              Escanear Guías
            </h1>

            <div className="text-white/60 text-sm">
              {selectedWarehouse?.name}
            </div>

            {/* Indicador de transportadora bloqueada */}
            {batchCarrier && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-400/30">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-medium text-blue-300">
                  Solo {batchCarrier.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer overlay (semi-transparente) - Contador + Último escaneo */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="p-4 bg-dark-950/85 backdrop-blur-xl border-t border-white/10">
          {/* Contador de stats */}
          <div className="flex items-center justify-around mb-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{batchStats.success}</div>
              <div className="text-white/60 text-xs">✅ Nuevas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {batchStats.repeatedToday + batchStats.repeatedOtherDay + batchStats.draftDuplicate}
              </div>
              <div className="text-white/60 text-xs">⚠️ Repetidas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">
                {batchStats.errorNotReady + batchStats.errorNotFound + batchStats.errorOther + batchStats.alreadyScanned}
              </div>
              <div className="text-white/60 text-xs">❌ Errores</div>
            </div>
          </div>

          {/* Último escaneo (compacto) */}
          {lastScan && (
            <div className={`p-3 rounded-xl border ${
              lastScan.isError || lastScan.isRepeated
                ? 'bg-red-500/20 border-red-400/30'
                : 'bg-green-500/20 border-green-400/30'
            }`}>
              <div className="flex items-center gap-3">
                {lastScan.isError || lastScan.isRepeated ? (
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {lastScan.customerName || lastScan.code}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {lastScan.carrier}
                    {lastScan.itemsCount && ` • ${lastScan.itemsCount} productos`}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${
                  lastScan.isError || lastScan.isRepeated
                    ? 'bg-red-500/30 text-red-100'
                    : 'bg-green-500/30 text-green-100'
                }`}>
                  {lastScan.isError
                    ? '🚫'
                    : lastScan.isRepeated
                      ? '⚠️'
                      : '✅'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Tip de escaneo */}
          {!lastScan && (
            <div className="text-center">
              <p className="text-white/60 text-xs mb-1">
                💡 Para códigos de barras, manténgalos <span className="text-emerald-400 font-semibold">HORIZONTALES</span>
              </p>
              <p className="text-white/40 text-xs">
                ✅ Soporta QR • Código de Barras • EAN • UPC
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scan Animation Ring */}
      {scanAnimation && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
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

      {/* Processing indicator - solo barra pequeña en top, no bloquea cámara */}
      {isProcessing && (
        <div className="absolute top-0 left-0 right-0 z-30 h-1">
          <div className="h-1 bg-primary-500 animate-pulse w-full" />
        </div>
      )}
    </div>
  );
}

export default ScanGuide;
