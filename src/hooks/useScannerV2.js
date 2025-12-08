import { useState, useCallback, useEffect } from 'react';
import { codesService, carriersService, storesService } from '../services/supabase-v2';
import { procesarCodigoConCarriers, detectScanType } from '../utils/validators-v2';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

/**
 * Hook personalizado para manejar la lógica del scanner
 * Versión 2: Usa transportadoras dinámicas desde la BD
 */
export function useScannerV2() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [carriers, setCarriers] = useState([]);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(true);
  
  const {
    operatorId,
    selectedStore,
    incrementSessionScans,
    incrementSessionRepeated,
    isInCache,
    addToCache
  } = useStore();

  // Cargar transportadoras al montar el componente
  useEffect(() => {
    loadCarriers();
  }, []);

  const loadCarriers = async () => {
    try {
      setIsLoadingCarriers(true);
      const data = await carriersService.getAll();
      setCarriers(data);
      console.log('✅ Transportadoras cargadas:', data.map(c => c.display_name));
    } catch (error) {
      console.error('❌ Error cargando transportadoras:', error);
      toast.error('Error cargando transportadoras');
    } finally {
      setIsLoadingCarriers(false);
    }
  };

  /**
   * Procesa un código escaneado
   */
  const processScan = useCallback(async (rawCode) => {
    if (isProcessing) {
      console.log('⏸️ Ya procesando otro código...');
      return { success: false, reason: 'processing' };
    }

    if (carriers.length === 0) {
      toast.error('Cargando transportadoras...');
      return { success: false, reason: 'loading_carriers' };
    }

    setIsProcessing(true);

    try {
      // 1. Procesar y validar el código contra todas las transportadoras
      const resultado = await procesarCodigoConCarriers(rawCode, carriers);
      
      if (!resultado.valido) {
        toast.error(resultado.error);
        setIsProcessing(false);
        return { success: false, reason: 'invalid', error: resultado.error };
      }

      const { codigo, carrier, carrierId, carrierName } = resultado;
      const scanType = detectScanType(rawCode);

      console.log('✅ Código válido:', {
        codigo,
        carrier: carrierName,
        scanType,
        original: rawCode.substring(0, 50)
      });

      // 2. Verificar en cache local primero (más rápido)
      if (isInCache(codigo)) {
        console.log('⚠️ Código repetido (detectado en cache)');
        incrementSessionRepeated();
        
        setLastScan({
          code: codigo,
          carrier: carrierName,
          isRepeated: true
        });

        toast.error(`${codigo} - ${carrierName}\n⚠️ REPETIDO`, {
          duration: 2000,
          icon: '⚠️'
        });

        setTimeout(() => setIsProcessing(false), 1500);
        return { success: false, reason: 'repeated' };
      }

      // 3. Verificar en base de datos
      const exists = await codesService.exists(codigo);

      if (exists) {
        console.log('⚠️ Código repetido (detectado en BD)');
        incrementSessionRepeated();
        addToCache(codigo);
        
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

      // 4. Obtener o crear tienda si hay una seleccionada
      let storeId = null;
      if (selectedStore) {
        try {
          const store = await storesService.getOrCreate(selectedStore);
          storeId = store.id;
        } catch (error) {
          console.warn('⚠️ Error obteniendo tienda:', error);
          // Continuar sin tienda
        }
      }

      // 5. Código NUEVO - Guardar en base de datos
      console.log('✅ Código NUEVO - Guardando...');
      
      const newCode = await codesService.create({
        code: codigo,
        carrier_id: carrierId,
        store_id: storeId,
        operator_id: operatorId,
        raw_scan: rawCode.substring(0, 500), // Limitar longitud
        scan_type: scanType
      });

      // 6. Agregar al cache
      addToCache(codigo);

      // 7. Incrementar contadores
      incrementSessionScans();

      // 8. Mostrar feedback de éxito
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
  }, [isProcessing, operatorId, selectedStore, carriers, isInCache, addToCache, incrementSessionScans, incrementSessionRepeated]);

  return {
    processScan,
    isProcessing,
    lastScan,
    carriers,
    isLoadingCarriers,
    reloadCarriers: loadCarriers
  };
}
