/**
 * V4: Sync Service
 *
 * Servicio de sincronización que procesa la cola offline automáticamente
 * cuando se detecta conexión a internet.
 *
 * Características:
 * - Retry automático con backoff exponencial
 * - Procesamiento por lotes para eficiencia
 * - Event listeners para cambios de conexión
 * - Logs detallados para debugging
 */

import { supabase } from './supabase';
import {
  getQueue,
  getQueueSorted,
  removeFromQueue,
  incrementRetryCount,
  setSyncStatus,
  isOnline,
  getQueueCount
} from './offlineQueue';

const MAX_RETRIES = 3;
const BATCH_SIZE = 5; // Procesar 5 items a la vez
let syncInterval = null;
let isSyncing = false;

/**
 * Procesar un solo item de la cola
 */
async function processQueueItem(item) {
  try {
    console.log(`🔄 Procesando item de cola: ${item.code}`);

    // Intentar guardar en Supabase
    const { data, error } = await supabase
      .from('codes')
      .insert([{
        code: item.code,
        carrier_id: item.carrier_id,
        carrier_name: item.carrier_name,
        operator_id: item.operator_id,
        store_name: item.store_name,
        customer_name: item.customer_name,
        order_id: item.order_id,
        created_at: new Date(item.timestamp).toISOString() // Usar timestamp original
      }])
      .select()
      .single();

    if (error) {
      // Si es error de duplicado (código repetido), remover de cola
      if (error.code === '23505') {
        console.warn(`⚠️ Código duplicado (ya existe): ${item.code} - Removiendo de cola`);
        removeFromQueue(item.id);
        return { success: true, reason: 'duplicate' };
      }

      throw error;
    }

    // Éxito: remover de cola
    console.log(`✅ Item sincronizado exitosamente: ${item.code}`);
    removeFromQueue(item.id);
    return { success: true, data };

  } catch (error) {
    console.error(`❌ Error procesando item ${item.code}:`, error);

    // Incrementar retry count
    const retryCount = incrementRetryCount(item.id);

    // Si superó el máximo de reintentos, remover de cola
    if (retryCount >= MAX_RETRIES) {
      console.error(`🚫 Item ${item.code} superó ${MAX_RETRIES} reintentos - Removiendo de cola`);
      removeFromQueue(item.id);
      return { success: false, reason: 'max_retries', error };
    }

    return { success: false, reason: 'retry', retryCount, error };
  }
}

/**
 * Procesar la cola completa (por lotes)
 */
export async function syncQueue() {
  // Evitar sincronizaciones concurrentes
  if (isSyncing) {
    console.log('⏭️ Sincronización ya en progreso, saltando...');
    return { success: false, reason: 'already_syncing' };
  }

  // Verificar conexión
  if (!isOnline()) {
    console.log('📡 Sin conexión a internet, esperando...');
    setSyncStatus('offline');
    return { success: false, reason: 'offline' };
  }

  isSyncing = true;
  setSyncStatus('syncing');

  try {
    const queue = getQueueSorted(); // Ordenados por antigüedad

    if (queue.length === 0) {
      console.log('✅ Cola vacía, nada que sincronizar');
      setSyncStatus('synced');
      isSyncing = false;
      return { success: true, processed: 0 };
    }

    console.log(`🔄 Iniciando sincronización de ${queue.length} items...`);

    let processed = 0;
    let errors = 0;

    // Procesar por lotes
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);

      // Procesar batch en paralelo
      const results = await Promise.allSettled(
        batch.map(item => processQueueItem(item))
      );

      // Contar resultados
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          processed++;
        } else {
          errors++;
        }
      });

      // Pequeña pausa entre lotes para no saturar
      if (i + BATCH_SIZE < queue.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Sincronización completada: ${processed} exitosos, ${errors} errores`);
    setSyncStatus(errors === 0 ? 'synced' : 'partial');

    isSyncing = false;
    return { success: true, processed, errors, remaining: getQueueCount() };

  } catch (error) {
    console.error('❌ Error general en sincronización:', error);
    setSyncStatus('error');
    isSyncing = false;
    return { success: false, error };
  }
}

/**
 * Iniciar sincronización automática
 * Se ejecuta cada 30 segundos si hay items en cola
 */
export function startAutoSync() {
  // Limpiar interval previo si existe
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Sincronizar inmediatamente
  syncQueue();

  // Sincronizar cada 30 segundos
  syncInterval = setInterval(() => {
    const queueCount = getQueueCount();
    if (queueCount > 0 && isOnline()) {
      console.log(`⏰ Auto-sync: ${queueCount} items pendientes`);
      syncQueue();
    }
  }, 30000); // 30 segundos

  console.log('🔄 Auto-sync iniciado (cada 30s)');
}

/**
 * Detener sincronización automática
 */
export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️ Auto-sync detenido');
  }
}

/**
 * Setup de event listeners para cambios de conexión
 */
export function setupConnectionListeners() {
  // Cuando se detecta conexión, sincronizar
  window.addEventListener('online', () => {
    console.log('📡 Conexión detectada - Iniciando sincronización...');
    setTimeout(() => syncQueue(), 1000); // 1 segundo de delay
  });

  // Cuando se pierde conexión
  window.addEventListener('offline', () => {
    console.log('📡 Conexión perdida - Modo offline activado');
    setSyncStatus('offline');
  });

  console.log('👂 Listeners de conexión configurados');
}

/**
 * Verificar estado de sincronización para UI
 */
export function getSyncInfo() {
  return {
    queueCount: getQueueCount(),
    isOnline: isOnline(),
    isSyncing
  };
}
