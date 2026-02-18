/**
 * Servicio para integración con Dunamixfy CO API
 * Endpoint: https://dunamixfy.bubbleapps.io/api/1.1/wf/dfx_scanner_get_orderinfo
 */

const API_KEY = 'd82b1fe06d0267b8efb596dd8190c983';
const BASE_URL = 'https://dunamixfy.bubbleapps.io/api/1.1/wf';

export const dunamixfyApi = {
  /**
   * Obtener información de una orden desde Dunamixfy CO
   * @param {string} code - Código escaneado
   * @returns {Promise<Object>} - Información de la orden
   */
  async getOrderInfo(code) {
    try {
      console.log('🔍 Consultando orden en Dunamixfy CO:', code);

      // Timeout de 5 segundos para evitar esperas indefinidas
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response;
      try {
        response = await fetch(`${BASE_URL}/dfx_scanner_get_orderinfo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({ code }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ Respuesta de Dunamixfy CO:', data);

      // Validar si hay error_response (dentro de data.response)
      if (data && data.response && data.response.error_response) {
        const errorMsg = data.response.error_response.toLowerCase();
        let errorType = 'UNKNOWN';
        let userMessage = data.response.error_response;

        // Detectar tipo de error por el mensaje
        if (errorMsg.includes('no esta listo') || errorMsg.includes('no puede') || errorMsg.includes('despachar')) {
          errorType = 'NOT_READY';
          userMessage = '⚠️ Pedido no listo para despachar';
        } else if (errorMsg.includes('no existe') || errorMsg.includes('not found') || errorMsg.includes('no encontrada')) {
          errorType = 'NOT_FOUND';
          userMessage = '❌ Número de guía no existe';
        } else if (errorMsg.includes('ya') && (errorMsg.includes('escaneada') || errorMsg.includes('escaneado') || errorMsg.includes('scanned'))) {
          errorType = 'ALREADY_SCANNED';
          userMessage = '🔄 Esta orden ya fue escaneada anteriormente';
        }

        console.warn(`⚠️ Error de Dunamixfy [${errorType}]:`, data.response.error_response);

        return {
          success: false,
          canShip: false,
          errorType,
          error: userMessage,
          rawError: data.response.error_response,
          data: null
        };
      }

      // Validar que la orden existe y tiene datos válidos
      if (!data || !data.response || data.response.error_response) {
        return {
          success: false,
          canShip: null,
          errorType: 'NOT_FOUND',
          error: '❌ Orden no encontrada en Dunamixfy'
        };
      }

      // Transformar respuesta al formato esperado
      return {
        success: true,
        canShip: true,
        data: {
          order_id: data.response.order_id,
          firstname: data.response.firstname,
          lastname: data.response.lastname,
          order_items: data.response.orderItems, // Transformar camelCase a snake_case
          sync_status: data.response.sync_status,
          pay_type: data.response.pay_type,
          transportadora: data.response.transportadora,
          store: data.response.store,
          raw_response: data.response // Guardar respuesta completa
        }
      };

    } catch (error) {
      console.error('❌ Error consultando Dunamixfy CO:', error);

      // Detectar timeout específicamente
      if (error.name === 'AbortError') {
        return {
          success: false,
          errorType: 'TIMEOUT',
          error: '⏱️ Tiempo de espera agotado (Dunamixfy no respondió en 5s)\nIntenta escanear de nuevo'
        };
      }

      return {
        success: false,
        errorType: 'ERROR_OTHER',
        error: error.message || 'Error al consultar la orden'
      };
    }
  },

  /**
   * Verificar si el código existe en Dunamixfy CO
   * @param {string} code - Código a verificar
   * @returns {Promise<boolean>}
   */
  async verifyCode(code) {
    const result = await this.getOrderInfo(code);
    return result.success;
  }
};
