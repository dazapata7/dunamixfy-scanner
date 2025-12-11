/**
 * V4: Offline Queue Service
 *
 * Sistema de cola para guardar escaneos cuando no hay conexión a internet.
 * Los escaneos se guardan en localStorage y se sincronizan automáticamente
 * cuando se recupera la conexión.
 *
 * Beneficios:
 * - Funciona sin internet (crítico para bodegas con mala señal)
 * - Sincronización automática en background
 * - No se pierden escaneos aunque falle la conexión
 */

const QUEUE_KEY = 'dunamix_offline_queue';
const SYNC_STATUS_KEY = 'dunamix_sync_status';

// Estructura de un item en la queue:
// {
//   id: string (UUID temporal),
//   code: string,
//   carrier_id: number,
//   carrier_name: string,
//   operator_id: number,
//   store_name: string,
//   customer_name: string,
//   order_id: string,
//   timestamp: number,
//   retryCount: number
// }

/**
 * Agregar un escaneo a la cola offline
 */
export function addToQueue(scanData) {
  try {
    const queue = getQueue();
    const queueItem = {
      id: crypto.randomUUID(), // ID temporal único
      ...scanData,
      timestamp: Date.now(),
      retryCount: 0
    };

    queue.push(queueItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    console.log('📦 Escaneo guardado en cola offline:', queueItem.code);
    return queueItem;
  } catch (error) {
    console.error('❌ Error guardando en cola offline:', error);
    return null;
  }
}

/**
 * Obtener la cola completa
 */
export function getQueue() {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('❌ Error leyendo cola offline:', error);
    return [];
  }
}

/**
 * Obtener cantidad de items pendientes
 */
export function getQueueCount() {
  return getQueue().length;
}

/**
 * Remover un item de la cola (después de sincronizar exitosamente)
 */
export function removeFromQueue(itemId) {
  try {
    const queue = getQueue();
    const newQueue = queue.filter(item => item.id !== itemId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    console.log('✅ Item removido de cola:', itemId);
    return true;
  } catch (error) {
    console.error('❌ Error removiendo de cola:', error);
    return false;
  }
}

/**
 * Limpiar toda la cola (solo usar en casos extremos)
 */
export function clearQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
    console.log('🧹 Cola offline limpiada');
    return true;
  } catch (error) {
    console.error('❌ Error limpiando cola:', error);
    return false;
  }
}

/**
 * Actualizar retry count de un item
 */
export function incrementRetryCount(itemId) {
  try {
    const queue = getQueue();
    const item = queue.find(item => item.id === itemId);
    if (item) {
      item.retryCount++;
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
    return item?.retryCount || 0;
  } catch (error) {
    console.error('❌ Error actualizando retry count:', error);
    return 0;
  }
}

/**
 * Guardar estado de sincronización
 */
export function setSyncStatus(status) {
  try {
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({
      lastSync: Date.now(),
      status, // 'syncing' | 'synced' | 'error'
      queueCount: getQueueCount()
    }));
  } catch (error) {
    console.error('❌ Error guardando estado sync:', error);
  }
}

/**
 * Obtener estado de sincronización
 */
export function getSyncStatus() {
  try {
    const status = localStorage.getItem(SYNC_STATUS_KEY);
    return status ? JSON.parse(status) : { status: 'synced', queueCount: 0 };
  } catch (error) {
    console.error('❌ Error leyendo estado sync:', error);
    return { status: 'error', queueCount: 0 };
  }
}

/**
 * Verificar si hay conexión a internet
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Verificar si hay items antiguos (más de 24 horas) que no se han sincronizado
 */
export function hasStaleItems() {
  const queue = getQueue();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  return queue.some(item => (now - item.timestamp) > ONE_DAY);
}

/**
 * Obtener items ordenados por antigüedad (los más viejos primero)
 */
export function getQueueSorted() {
  const queue = getQueue();
  return queue.sort((a, b) => a.timestamp - b.timestamp);
}
