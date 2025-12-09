/**
 * Servicio para integración con Dunamixfy CO API
 * Endpoint: https://dunamixfy.bubbleapps.io/version-test/api/1.1/wf/dfx_scanner_get_orderinfo
 */

const API_KEY = 'd82b1fe06d0267b8efb596dd8190c983';
const BASE_URL = 'https://dunamixfy.bubbleapps.io/version-test/api/1.1/wf';

export const dunamixfyApi = {
  /**
   * Obtener información de una orden desde Dunamixfy CO
   * @param {string} code - Código escaneado
   * @returns {Promise<Object>} - Información de la orden
   */
  async getOrderInfo(code) {
    try {
      console.log('🔍 Consultando orden en Dunamixfy CO:', code);

      const response = await fetch(`${BASE_URL}/dfx_scanner_get_orderinfo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          code: code
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ Respuesta de Dunamixfy CO:', data);

      // Validar que la orden existe
      if (!data || !data.response) {
        return {
          success: false,
          error: 'Orden no encontrada en Dunamixfy CO'
        };
      }

      // Transformar respuesta al formato esperado
      return {
        success: true,
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
      return {
        success: false,
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
