import { useState, useCallback, useEffect, useRef } from 'react';
import { codesService, carriersService } from '../services/supabase';
import { procesarCodigoConCarriers, detectScanType } from '../utils/validators';
import { useStore } from '../store/useStore';
import { dunamixfyApi } from '../services/dunamixfyApi';
import toast from 'react-hot-toast';

/**
 * ============================================================================
 * HOOK: useScanner - V3
 * ============================================================================
 * Hook personalizado para manejar la lógica del scanner de códigos QR/Barcode
 *
 * Cambios V3 respecto a V2:
 * - V2: Guardaba datos en tablas separadas (codes, orders, stores)
 * - V3: Cache mínimo en tabla codes (order_id, customer_name, carrier_name, store_name)
 * - V3: Dunamixfy es fuente única de verdad - consulta real-time
 * - V3: Retención 7 días con auto-limpieza programada
 *
 * Ventajas V3:
 * - Arquitectura simplificada: 1 tabla vs 3 tablas
 * - Datos frescos: siempre consulta Dunamixfy en tiempo real
 * - Sin redundancia: Dunamixfy maneja states, orders, stores
 * - Transitorio: Scanner es solo log temporal (7 días)
 *
 * Estado retornado:
 * - processScan: Función para procesar códigos escaneados
 * - isProcessing: Boolean indicando si está procesando
 * - lastScan: Último código escaneado (para feedback visual)
 * - carriers: Array de transportadoras activas
 * - isLoadingCarriers: Boolean indicando carga de transportadoras
 * - reloadCarriers: Función para recargar transportadoras
 */
export function useScanner() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  // V2: Estado para transportadoras dinámicas desde BD
  const [carriers, setCarriers] = useState([]);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(true);

  // V2 FIX: Usar ref para tener siempre la versión más reciente de carriers
  const carriersRef = useRef(carriers);
  useEffect(() => {
    carriersRef.current = carriers;
  }, [carriers]);

  const {
    operatorId,
    selectedStore,
    incrementSessionScans,
    incrementSessionRepeated,
    isInCache,
    addToCache
  } = useStore();

  /**
   * V2: Cargar transportadoras al montar el componente
   * Esto permite validar códigos contra cualquier transportadora activa en BD
   */
  useEffect(() => {
    loadCarriers();
  }, []);

  /**
   * V2: Función para cargar transportadoras desde BD
   * Se ejecuta al montar el componente y puede re-ejecutarse si se agregan nuevas
   */
  const loadCarriers = async () => {
    try {
      setIsLoadingCarriers(true);
      console.log('🔄 Intentando cargar transportadoras desde BD...');

      const data = await carriersService.getAll(); // V2: Llamada a BD

      console.log('✅ Transportadoras cargadas:', {
        count: data?.length,
        carriers: data?.map(c => ({
          id: c.id,
          name: c.display_name,
          code: c.code,
          validation_rules: c.validation_rules,
          extraction_config: c.extraction_config
        }))
      });

      setCarriers(data);

      if (!data || data.length === 0) {
        console.warn('⚠️ No se encontraron transportadoras activas en la BD');
        toast.error('No hay transportadoras configuradas en la base de datos');
      }
    } catch (error) {
      console.error('❌ Error cargando transportadoras:', {
        error,
        message: error.message,
        stack: error.stack
      });
      toast.error('Error cargando transportadoras: ' + error.message);
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  /**
   * ============================================================================
   * FUNCIÓN: processScan - V3
   * ============================================================================
   * Procesa un código escaneado (QR o Barcode)
   *
   * Flujo V3 simplificado:
   * 1. Validar que no esté procesando otro código
   * 2. Validar contra todas las transportadoras
   * 3. Verificar duplicado en cache (rápido)
   * 4. Verificar duplicado en BD (definitivo)
   * 5. V3: Consultar Dunamixfy CO en tiempo real
   * 6. V3: Guardar código con cache mínimo (order_id, customer_name, carrier_name, store_name)
   * 7. Agregar al cache para futuras validaciones
   * 8. Mostrar feedback al usuario
   *
   * Diferencias V3 vs V2:
   * - V2: Guardaba orden completa en tabla 'orders' separada
   * - V3: Cachea solo campos básicos en tabla 'codes'
   * - V2: Guardaba store_id como foreign key a tabla 'stores'
   * - V3: Cachea store_name como TEXT (Dunamixfy es fuente de verdad)
   * - V3: Elimina dependencias de ordersService y storesService
   *
   * @param {string} rawCode - Código raw del scanner (QR o Barcode completo)
   * @returns {object} { success: boolean, reason?: string, data?: object }
   */
  const processScan = useCallback(async (rawCode) => {
    // V2 FIX: Obtener carriers desde la ref para tener la versión más reciente
    const currentCarriers = carriersRef.current;

    console.log('🚀 processScan INICIADO:', {
      rawCode: rawCode.substring(0, 50),
      isProcessing,
      carriersLength: currentCarriers.length
    });

    // Paso 1: Evitar procesamiento concurrente
    if (isProcessing) {
      console.log('⏸️ Ya procesando otro código...');
      return { success: false, reason: 'processing' };
    }

    // V2: Verificar que las transportadoras estén cargadas
    if (currentCarriers.length === 0) {
      console.error('❌ No hay carriers cargados!');
      toast.error('Cargando transportadoras...');
      return { success: false, reason: 'loading_carriers' };
    }

    console.log('✅ Iniciando procesamiento con', currentCarriers.length, 'carriers');
    setIsProcessing(true);

    try {
      console.log('🔍 Llamando procesarCodigoConCarriers...');
      // Paso 2: V2 - Procesar y validar contra todas las transportadoras
      // Esta función ahora recibe el array de carriers desde BD
      const resultado = await procesarCodigoConCarriers(rawCode, currentCarriers);
      console.log('📋 Resultado validación:', resultado);

      if (!resultado.valido) {
        toast.error(resultado.error);
        setIsProcessing(false);
        return { success: false, reason: 'invalid', error: resultado.error };
      }

      // V3: Extraer información de la transportadora detectada
      const { codigo, carrierId, carrierName } = resultado;

      // V3: Detectar tipo de escaneo (QR vs Barcode)
      const scanType = detectScanType(rawCode);

      console.log('✅ Código válido:', {
        codigo,
        carrier: carrierName,
        scanType,
        original: rawCode.substring(0, 50)
      });

      // Paso 3: Verificar en cache local primero (más rápido que BD)
      if (isInCache(codigo)) {
        console.log('⚠️ Código repetido (detectado en cache)');
        incrementSessionRepeated();

        setLastScan({
          code: codigo,
          carrier: carrierName, // V2: Usa display_name de BD
          isRepeated: true
        });

        toast.error(`${carrierName} - REPETIDO`, {
          duration: 4000,
          icon: '⚠️',
          style: {
            background: '#ef4444',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px 24px',
            borderRadius: '12px',
          }
        });

        setTimeout(() => setIsProcessing(false), 1500);
        return { success: false, reason: 'repeated' };
      }

      // Paso 4: Verificar en base de datos (definitivo)
      const exists = await codesService.exists(codigo);

      if (exists) {
        console.log('⚠️ Código repetido (detectado en BD)');
        incrementSessionRepeated();
        addToCache(codigo); // Agregar al cache para próximas veces

        setLastScan({
          code: codigo,
          carrier: carrierName,
          isRepeated: true
        });

        toast.error(`${carrierName} - REPETIDO`, {
          duration: 4000,
          icon: '⚠️',
          style: {
            background: '#ef4444',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px 24px',
            borderRadius: '12px',
          }
        });

        setTimeout(() => setIsProcessing(false), 1500);
        return { success: false, reason: 'repeated' };
      }

      // Paso 5: V3 - Consultar información de la orden en Dunamixfy CO (tiempo real)
      let orderCache = {
        order_id: null,
        customer_name: null,
        store_name: null
      };

      try {
        console.log('🌐 Consultando orden en Dunamixfy CO...');
        const orderInfo = await dunamixfyApi.getOrderInfo(codigo);

        if (orderInfo.success) {
          console.log('✅ Orden encontrada en Dunamixfy:', orderInfo.data);

          // V3: Extraer campos para cache mínimo
          const firstName = orderInfo.data.firstname || '';
          const lastName = orderInfo.data.lastname || '';
          const customerName = `${firstName} ${lastName}`.trim();

          orderCache = {
            order_id: orderInfo.data.order_id || null,
            customer_name: customerName || null,
            store_name: orderInfo.data.store || null
          };

          // Mostrar info del cliente en toast
          if (customerName) {
            toast.success(`👤 ${customerName}`, {
              duration: 5000,
              icon: '📦',
              style: {
                background: '#3b82f6',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 'bold',
                padding: '20px 28px',
                borderRadius: '16px',
                maxWidth: '90vw',
              }
            });
          }
        } else if (orderInfo.canShip === false) {
          // ALERTA: El pedido NO puede ser despachado (can_ship = NO)
          // NO GUARDAR EN BASE DE DATOS - Solo pedidos listos para despacho
          console.error('🚫 PEDIDO NO PUEDE SER DESPACHADO:', orderInfo.error);
          console.warn('⚠️ Código NO guardado - Pedido no listo para despacho');

          // Mostrar alerta PROMINENTE al usuario
          toast.error(orderInfo.error, {
            duration: 10000,
            icon: '🚫',
            style: {
              background: '#ef4444',
              color: '#fff',
              fontSize: '20px',
              fontWeight: 'bold',
              padding: '24px 32px',
              borderRadius: '16px',
              maxWidth: '90vw',
              border: '3px solid #dc2626',
              boxShadow: '0 10px 40px rgba(239, 68, 68, 0.5)',
            }
          });

          // Vibración de alerta (si el dispositivo lo soporta)
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }

          // NO continuar con el guardado - salir del proceso
          setTimeout(() => setIsProcessing(false), 2000);
          return {
            success: false,
            reason: 'cannot_ship',
            error: orderInfo.error
          };
        } else {
          console.warn('⚠️ Orden no encontrada en Dunamixfy CO:', orderInfo.error);
        }
      } catch (orderError) {
        console.error('❌ Error consultando Dunamixfy CO:', orderError);
        // Continuar con el escaneo aunque falle la consulta
      }

      // Paso 6: V3 - Guardar código con cache mínimo de Dunamixfy
      console.log('✅ Código NUEVO - Guardando con cache...');

      const newCode = await codesService.create({
        code: codigo,                           // Código normalizado
        carrier_id: carrierId,                  // UUID foreign key a carriers
        operator_id: operatorId,                // UUID foreign key a operators
        raw_scan: rawCode.substring(0, 500),    // QR/Barcode completo (limitado)
        scan_type: scanType,                    // 'qr' | 'barcode' | 'manual'
        // V3: Cache mínimo de Dunamixfy (evitar re-consultas innecesarias)
        order_id: orderCache.order_id,
        customer_name: orderCache.customer_name,
        carrier_name: carrierName,
        store_name: orderCache.store_name
      });

      // Paso 7: Agregar al cache para validaciones futuras en sesión
      addToCache(codigo);

      // Paso 8: Incrementar contadores de sesión
      incrementSessionScans();

      // Paso 9: Mostrar feedback de éxito al usuario
      setLastScan({
        code: codigo,
        carrier: carrierName,
        isRepeated: false
      });

      toast.success(`${carrierName}`, {
        duration: 4000,
        icon: '✅',
        style: {
          background: '#10b981',
          color: '#fff',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '16px 24px',
          borderRadius: '12px',
        }
      });

      console.log('✅ Código guardado exitosamente:', newCode);

      setTimeout(() => setIsProcessing(false), 1500);
      return { success: true, data: newCode };

    } catch (error) {
      console.error('❌ Error al procesar código:', error);
      toast.error('Error al guardar el código');
      setIsProcessing(false);
      return { success: false, reason: 'error', error };
    }
  }, [isProcessing, operatorId, selectedStore, isInCache, addToCache, incrementSessionScans, incrementSessionRepeated]);
  // V2 FIX: No incluimos 'carriers' en las dependencias porque usamos carriersRef.current

  /**
   * V2: Retornar estado adicional para transportadoras
   * Esto permite a los componentes mostrar loading states y recargar si es necesario
   */
  return {
    processScan,
    isProcessing,
    lastScan,
    carriers,              // V2: Array de transportadoras activas
    isLoadingCarriers,     // V2: Loading state
    reloadCarriers: loadCarriers  // V2: Función para recargar
  };
}
