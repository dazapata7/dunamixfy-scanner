/**
 * Servicio para backfill de datos de Dunamixfy en códigos antiguos
 */
import { supabase } from './supabase';
import { dunamixfyApi } from './dunamixfyApi';

export const backfillService = {
  /**
   * Obtener todos los códigos que necesitan backfill
   * @returns {Promise<Array>} Códigos con datos NULL
   */
  async getCodesNeedingBackfill() {
    const { data, error } = await supabase
      .from('codes')
      .select('id, code, customer_name, order_id, store_name, carrier_name')
      .or('customer_name.is.null,order_id.is.null,store_name.is.null')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Actualizar un código con datos de Dunamixfy
   * @param {Object} code - Código a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateCodeFromDunamixfy(code) {
    try {
      console.log(`🔄 Backfill: Consultando Dunamixfy para código ${code.code}...`);

      // Consultar Dunamixfy
      const orderInfo = await dunamixfyApi.getOrderInfo(code.code);

      if (!orderInfo.success) {
        // Si canShip es false, aún intentar guardar datos básicos si existen
        if (orderInfo.canShip === false && orderInfo.data) {
          const firstName = orderInfo.data.firstname || '';
          const lastName = orderInfo.data.lastname || '';
          const customerName = `${firstName} ${lastName}`.trim();

          const updateData = {
            order_id: orderInfo.data.order_id || null,
            customer_name: customerName || null,
            store_name: orderInfo.data.store || null
          };

          await supabase
            .from('codes')
            .update(updateData)
            .eq('id', code.id);

          return {
            success: true,
            code: code.code,
            warning: `Actualizado con advertencia: ${orderInfo.error}`
          };
        }

        return {
          success: false,
          code: code.code,
          error: orderInfo.error || 'No se encontró información en Dunamixfy'
        };
      }

      // Preparar datos para actualizar
      const firstName = orderInfo.data.firstname || '';
      const lastName = orderInfo.data.lastname || '';
      const customerName = `${firstName} ${lastName}`.trim();

      const updateData = {
        order_id: orderInfo.data.order_id || null,
        customer_name: customerName || null,
        store_name: orderInfo.data.store || null
      };

      // Actualizar en Supabase
      const { data: updatedCode, error } = await supabase
        .from('codes')
        .update(updateData)
        .eq('id', code.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Backfill: Código ${code.code} actualizado exitosamente`);
      return {
        success: true,
        code: code.code,
        data: updatedCode
      };

    } catch (error) {
      console.error(`❌ Backfill: Error procesando código ${code.code}:`, error);
      return {
        success: false,
        code: code.code,
        error: error.message
      };
    }
  },

  /**
   * Ejecutar backfill completo con reporte de progreso
   * @param {Function} onProgress - Callback para reportar progreso
   * @returns {Promise<Object>} Resumen del backfill
   */
  async runBackfill(onProgress) {
    const startTime = Date.now();

    // Obtener códigos que necesitan backfill
    console.log('📊 Obteniendo códigos que necesitan backfill...');
    const codes = await this.getCodesNeedingBackfill();

    if (codes.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        errors: []
      };
    }

    console.log(`📦 Encontrados ${codes.length} códigos para actualizar`);

    const results = {
      total: codes.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Procesar cada código con un delay para no saturar la API
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const progress = {
        current: i + 1,
        total: codes.length,
        code: code.code,
        percentage: Math.round(((i + 1) / codes.length) * 100)
      };

      // Reportar progreso
      if (onProgress) {
        onProgress(progress);
      }

      // Actualizar código
      const result = await this.updateCodeFromDunamixfy(code);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          code: result.code,
          error: result.error
        });
      }

      // Delay de 500ms entre peticiones para no saturar la API
      if (i < codes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const endTime = Date.now();
    results.duration = Math.round((endTime - startTime) / 1000);

    console.log('✅ Backfill completado:', results);
    return results;
  }
};
