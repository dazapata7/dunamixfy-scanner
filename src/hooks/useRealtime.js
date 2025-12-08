import { useEffect, useState } from 'react';
import { codesService } from '../services/supabase';
import { useStore } from '../store/useStore';

/**
 * ============================================================================
 * HOOK: useRealtime - V2
 * ============================================================================
 * Hook para sincronización en tiempo real con Supabase
 * Escucha cambios en la tabla 'codes' y actualiza el estado local automáticamente
 *
 * Cambios V2 respecto a V1:
 * - V1: Cargaba objetos completos al cache
 * - V2: Extrae solo el campo 'code' para el cache (más eficiente)
 * - V2: Compatible con nueva estructura de stats con byCarrier dinámico
 *
 * Funcionalidad:
 * - Carga datos iniciales al montar
 * - Suscripción a cambios INSERT en tabla codes
 * - Actualización automática de cache y estadísticas
 * - Cleanup al desmontar
 *
 * Estado retornado:
 * - isConnected: Boolean indicando estado de suscripción
 * - refresh: Función para recargar datos manualmente
 */
export function useRealtime() {
  const [isConnected, setIsConnected] = useState(false);
  const { addToCache, setTodayScans, setTodayStats } = useStore();

  /**
   * V2: Efecto principal - Carga inicial y suscripción a cambios
   */
  useEffect(() => {
    console.log('🔄 Iniciando sincronización en tiempo real...');

    // Paso 1: Cargar datos iniciales (cache + estadísticas)
    loadInitialData();

    // Paso 2: Suscribirse a cambios en tiempo real usando Supabase Realtime
    const unsubscribe = codesService.subscribeToChanges((payload) => {
      console.log('📡 Cambio detectado:', payload);

      // V2: Cuando se inserta un nuevo código, actualizar cache y stats
      if (payload.eventType === 'INSERT') {
        const newCode = payload.new;
        addToCache(newCode.code); // Agregar al cache local

        // Recargar estadísticas para reflejar el nuevo código
        loadStats();
      }
    });

    setIsConnected(true);

    // Paso 3: Cleanup - Desuscribirse al desmontar componente
    return () => {
      console.log('⏹️ Deteniendo sincronización...');
      unsubscribe();
      setIsConnected(false);
    };
  }, [addToCache, setTodayScans, setTodayStats]);

  /**
   * ============================================================================
   * FUNCIÓN: loadInitialData
   * ============================================================================
   * Carga datos iniciales al montar el componente
   *
   * V2: Cambio importante
   * - V1: useStore.getState().loadCachefromDB(allCodes) recibía objetos completos
   * - V2: Extrae solo el campo 'code' de cada objeto (más eficiente)
   *
   * Proceso:
   * 1. Cargar todos los códigos desde BD
   * 2. V2: Extraer solo los códigos (no objetos completos)
   * 3. Cargar al cache local para validación de duplicados
   * 4. Cargar estadísticas del día
   */
  const loadInitialData = async () => {
    try {
      console.log('📥 Cargando datos iniciales...');

      // V2: Cargar todos los códigos (usa codes_detailed en V2)
      const allCodes = await codesService.getAll();

      // V2: Extraer solo el campo 'code' de cada objeto para el cache
      // Esto es más eficiente que guardar objetos completos
      const codesArray = allCodes.map(c => c.code);
      useStore.getState().loadCachefromDB(codesArray);

      console.log(`✅ ${codesArray.length} códigos cargados en cache`);

      // Cargar estadísticas del día
      await loadStats();

    } catch (error) {
      console.error('❌ Error cargando datos iniciales:', error);
    }
  };

  /**
   * ============================================================================
   * FUNCIÓN: loadStats
   * ============================================================================
   * Carga estadísticas del día actual
   *
   * V2: Transformación de stats
   * - V1: stats tenía coordinadora e interrapidisimo hardcoded
   * - V2: stats.byCarrier es dinámico, necesitamos transformar para compatibilidad
   *
   * Estructura V2 de stats desde BD:
   * {
   *   total: 50,
   *   byCarrier: {
   *     coordinadora: 30,
   *     interrapidisimo: 20
   *   },
   *   byStore: {
   *     "Dunamixfy": 25,
   *     "Femme Cosmetics": 25
   *   }
   * }
   *
   * Transformación para compatibilidad con store:
   * {
   *   coordinadora: 30,
   *   interrapidisimo: 20,
   *   byStore: {...}
   * }
   */
  const loadStats = async () => {
    try {
      const todayCodes = await codesService.getToday();
      const stats = await codesService.getTodayStats();

      setTodayScans(todayCodes.length);

      // V2: Transformar stats de formato BD a formato store
      // Esto mantiene compatibilidad con componentes que esperan coordinadora/interrapidisimo
      const transformedStats = {
        coordinadora: stats.byCarrier?.coordinadora || 0,
        interrapidisimo: stats.byCarrier?.interrapidisimo || 0,
        byStore: stats.byStore || {}
      };

      setTodayStats(transformedStats);

      console.log('📊 Stats actualizadas:', transformedStats);
    } catch (error) {
      console.error('❌ Error cargando stats:', error);
    }
  };

  /**
   * V2: Retornar estado de conexión y función refresh
   */
  return {
    isConnected,
    refresh: loadInitialData // Permite refrescar manualmente si es necesario
  };
}
