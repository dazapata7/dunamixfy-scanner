// =====================================================
// DUNAMIXFY SERVICE - API Integration
// =====================================================
// Servicio para comunicarse con la API de Dunamixfy
// =====================================================

const DUNAMIXFY_BASE_URL = 'https://dunamixfy.bubbleapps.io/api/1.1';

/**
 * Marca un pedido como "unscanned" en Dunamixfy
 * Llamado cuando se elimina un dispatch en WMS
 *
 * @param {string} guideNumber - Número de guía/tracking code
 * @returns {Promise<Object>} Respuesta de Dunamixfy
 */
export async function markOrderAsUnscanned(guideNumber) {
  try {
    console.log(`📤 Marcando guía ${guideNumber} como unscanned en Dunamixfy...`);

    const response = await fetch(
      `${DUNAMIXFY_BASE_URL}/wf/dfx_scanner_set_unscanned`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guide_number: guideNumber
        })
      }
    );

    const data = await response.json();

    if (response.ok || data.status === 'SUCCESS') {
      console.log(`✅ Guía ${guideNumber} marcada como unscanned en Dunamixfy`, data);
      return {
        success: true,
        message: `Pedido marcado como unscanned en Dunamixfy`,
        data
      };
    } else {
      console.warn(`⚠️ Dunamixfy respondió con estado ${response.status}:`, data);
      return {
        success: false,
        message: data.message || 'Error al marcar como unscanned',
        data
      };
    }
  } catch (error) {
    console.error(`❌ Error al comunicarse con Dunamixfy:`, error);
    return {
      success: false,
      message: error.message || 'Error de conexión con Dunamixfy',
      error
    };
  }
}

/**
 * Obtiene información de una orden en Dunamixfy
 *
 * @param {string} guideNumber - Número de guía
 * @returns {Promise<Object>} Información de la orden
 */
export async function getOrderInfo(guideNumber) {
  try {
    const response = await fetch(
      `${DUNAMIXFY_BASE_URL}/wf/dfx_scanner_get_orderinfo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guide_number: guideNumber
        })
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error obteniendo info de orden:`, error);
    throw error;
  }
}

export const dunamixfyService = {
  markOrderAsUnscanned,
  getOrderInfo
};

export default dunamixfyService;
