import { useEffect, useState } from 'react';
import { codesService } from '../services/supabase-v2';
import { useStore } from '../store/useStore';

/**
 * Hook para sincronización en tiempo real
 * Versión 2: Compatible con nueva estructura de BD
 */
export function useRealtimeV2() {
  const [isConnected, setIsConnected] = useState(false);
  const { addToCache, setTodayScans, setTodayStats } = useStore();

  useEffect(() => {
    console.log('🔄 Iniciando sincronización en tiempo real...');

    // Cargar datos iniciales
    loadInitialData();

    // Suscribirse a cambios
    const unsubscribe = codesService.subscribeToChanges((payload) => {
      console.log('📡 Cambio detectado:', payload);
      
      if (payload.eventType === 'INSERT') {
        const newCode = payload.new;
        addToCache(newCode.code);
        
        // Recargar estadísticas
        loadStats();
      }
    });

    setIsConnected(true);

    return () => {
      console.log('⏹️ Deteniendo sincronización...');
      unsubscribe();
      setIsConnected(false);
    };
  }, [addToCache, setTodayScans, setTodayStats]);

  const loadInitialData = async () => {
    try {
      console.log('📥 Cargando datos iniciales...');
      
      // Cargar todos los códigos para el cache
      const allCodes = await codesService.getAll();
      const codesArray = allCodes.map(c => c.code);
      useStore.getState().loadCachefromDB(codesArray);
      
      console.log(`✅ ${codesArray.length} códigos cargados en cache`);
      
      // Cargar estadísticas del día
      await loadStats();
      
    } catch (error) {
      console.error('❌ Error cargando datos iniciales:', error);
    }
  };

  const loadStats = async () => {
    try {
      const todayCodes = await codesService.getToday();
      const stats = await codesService.getTodayStats();
      
      setTodayScans(todayCodes.length);
      
      // Transformar stats para el formato del store
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

  return {
    isConnected,
    refresh: loadInitialData
  };
}
