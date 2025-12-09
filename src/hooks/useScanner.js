import { useState, useCallback, useEffect, useRef } from 'react';
import { codesService, carriersService, storesService } from '../services/supabase';
import { procesarCodigoConCarriers, detectScanType } from '../utils/validators';
import { useStore } from '../store/useStore';
import { dunamixfyApi } from '../services/dunamixfyApi';
import { ordersService } from '../services/ordersService';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

/**
 * ============================================================================
 * HOOK: useScanner - V2
 * ============================================================================
 * Hook personalizado para manejar la lógica del scanner de códigos QR/Barcode
 *
 * Cambios V2 respecto a V1:
 * - V1: Validaba contra 2 transportadoras hardcoded (coordinadora, interrapidisimo)
 * - V2: Carga transportadoras dinámicamente desde BD y valida contra todas
 *
 * Ventajas V2:
 * - Agregar nuevas transportadoras sin modificar código (solo SQL INSERT)
 * - Validación dinámica basada en reglas JSON de cada transportadora
 * - Soporte para store_id, carrier_id y scan_type
 * - Escalabilidad ilimitada
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
   * FUNCIÓN: processScan
   * ============================================================================
   * Procesa un código escaneado (QR o Barcode)
   *
   * Flujo completo:
   * 1. Validar que no esté procesando otro código
   * 2. V2: Validar contra todas las transportadoras usando procesarCodigoConCarriers()
   * 3. Verificar duplicado en cache (rápido)
   * 4. Verificar duplicado en BD (definitivo)
   * 5. V2: Obtener o crear tienda si hay una seleccionada
   * 6. V2: Guardar con carrier_id, store_id, operator_id, raw_scan, scan_type
   * 7. Agregar al cache para futuras validaciones
   * 8. Mostrar feedback al usuario
   *
   * Diferencias V2 vs V1:
   * - V1: procesarCodigo() validaba solo contra 2 carriers hardcoded
   * - V2: procesarCodigoConCarriers(carriers) valida contra N carriers desde BD
   * - V1: Guardaba carrier como string ('coordinadora')
   * - V2: Guarda carrier_id (UUID foreign key)
   * - V2: Agrega scan_type ('qr' | 'barcode' | 'manual')
   * - V2: Agrega raw_scan (código completo antes de extraer)
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

      // V2: Extraer información de la transportadora detectada
      const { codigo, carrier, carrierId, carrierName } = resultado;

      // V2: Detectar tipo de escaneo (QR vs Barcode)
      const scanType = detectScanType(rawCode);

      console.log('✅ Código válido:', {
        codigo,
        carrier: carrierName,
        scanType, // V2: Nuevo campo
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

        toast.error(`${codigo} - ${carrierName}\n⚠️ REPETIDO`, {
          duration: 2000,
          icon: '⚠️'
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

        toast.error(`${codigo} - ${carrierName}\n⚠️ REPETIDO (YA EN BD)`, {
          duration: 2000,
          icon: '⚠️'
        });

        setTimeout(() => setIsProcessing(false), 1500);
        return { success: false, reason: 'repeated' };
      }

      // Paso 5: NUEVO - Consultar información de la orden en Dunamixfy CO
      console.log('🌐 Consultando orden en Dunamixfy CO...');
      const orderInfo = await dunamixfyApi.getOrderInfo(codigo);

      let orderData = null;
      if (orderInfo.success) {
        console.log('✅ Orden encontrada en Dunamixfy:', orderInfo.data);

        // Obtener user_id del usuario autenticado
        const { data: { user } } = await supabase.auth.getUser();

        // Guardar información de la orden en BD
        const orderResult = await ordersService.createOrUpdate(
          orderInfo.data,
          codigo,
          user?.id
        );

        if (orderResult.success) {
          orderData = orderResult.data;
          console.log('✅ Información de orden guardada:', orderData);

          // Mostrar info adicional en el toast
          const clientName = `${orderInfo.data.firstname || ''} ${orderInfo.data.lastname || ''}`.trim();
          if (clientName) {
            toast.success(`Cliente: ${clientName}`, {
              duration: 3000,
              icon: '👤'
            });
          }
        }
      } else {
        console.warn('⚠️ Orden no encontrada en Dunamixfy CO:', orderInfo.error);
        // Continuar con el escaneo aunque no se encuentre en Dunamixfy
      }

      // Paso 6: V2 - Obtener o crear tienda si hay una seleccionada
      // Esto permite relacionar el código con la tienda desde BD
      let storeId = null;
      if (selectedStore) {
        try {
          const store = await storesService.getOrCreate(selectedStore);
          storeId = store.id; // V2: UUID de la tienda
        } catch (error) {
          console.warn('⚠️ Error obteniendo tienda:', error);
          // Continuar sin tienda (storeId será null)
        }
      }

      // Paso 7: V2 - Código NUEVO - Guardar en base de datos con nuevos campos
      console.log('✅ Código NUEVO - Guardando...');

      const newCode = await codesService.create({
        code: codigo,                           // Código normalizado
        carrier_id: carrierId,                  // V2: UUID foreign key a carriers
        store_id: storeId,                      // V2: UUID foreign key a stores
        operator_id: operatorId,                // UUID foreign key a operators
        raw_scan: rawCode.substring(0, 500),    // V2: QR/Barcode completo (limitado)
        scan_type: scanType,                    // V2: 'qr' | 'barcode' | 'manual'
        order_data: orderData                   // NUEVO: Info de la orden desde Dunamixfy
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

      toast.success(`${codigo} - ${carrierName}\n✅ GUARDADO`, {
        duration: 2000,
        icon: '✅'
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
