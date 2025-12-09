import { supabase } from './supabase';

export const ordersService = {
  /**
   * Crear o actualizar una orden escaneada
   * @param {Object} orderData - Datos de la orden desde Dunamixfy API
   * @param {string} code - Código escaneado
   * @param {string} scannedBy - ID del usuario que escaneó
   */
  async createOrUpdate(orderData, code, scannedBy) {
    try {
      // Verificar si la orden ya existe
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('code', code)
        .single();

      if (existingOrder) {
        // Actualizar orden existente (incrementa scan_count automáticamente)
        const { data, error } = await supabase
          .from('orders')
          .update({
            ...orderData,
            code,
            scanned_by: scannedBy,
            scanned_at: new Date().toISOString()
          })
          .eq('code', code)
          .select()
          .single();

        if (error) throw error;

        console.log('✅ Orden actualizada (scan #' + data.scan_count + '):', data);
        return { success: true, data, isNew: false };
      } else {
        // Crear nueva orden
        const { data, error } = await supabase
          .from('orders')
          .insert([{
            ...orderData,
            code,
            scanned_by: scannedBy,
            scanned_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        console.log('✅ Orden creada:', data);
        return { success: true, data, isNew: true };
      }
    } catch (error) {
      console.error('❌ Error guardando orden:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Obtener todas las órdenes
   */
  async getAll() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('scanned_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener órdenes de hoy
   */
  async getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('scanned_at', today.toISOString())
      .order('scanned_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener órdenes por rango de fechas
   */
  async getByDateRange(startDate, endDate) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('scanned_at', startDate)
      .lte('scanned_at', endDate)
      .order('scanned_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener órdenes por transportadora
   */
  async getByCarrier(transportadora) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('transportadora', transportadora)
      .order('scanned_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener órdenes por tienda
   */
  async getByStore(store) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('store', store)
      .order('scanned_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Buscar orden por código
   */
  async getByCode(code) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('code', code)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obtener estadísticas de órdenes
   */
  async getStats(startDate = null, endDate = null) {
    let query = supabase
      .from('orders')
      .select('*');

    if (startDate) {
      query = query.gte('scanned_at', startDate);
    }
    if (endDate) {
      query = query.lte('scanned_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calcular estadísticas
    const stats = {
      total: data.length,
      byCarrier: {},
      byStore: {},
      byPayType: {},
      bySyncStatus: {},
      totalScans: data.reduce((sum, order) => sum + order.scan_count, 0)
    };

    data.forEach(order => {
      // Por transportadora
      if (order.transportadora) {
        stats.byCarrier[order.transportadora] = (stats.byCarrier[order.transportadora] || 0) + 1;
      }

      // Por tienda
      if (order.store) {
        stats.byStore[order.store] = (stats.byStore[order.store] || 0) + 1;
      }

      // Por tipo de pago
      if (order.pay_type) {
        stats.byPayType[order.pay_type] = (stats.byPayType[order.pay_type] || 0) + 1;
      }

      // Por estado de sincronización
      if (order.sync_status) {
        stats.bySyncStatus[order.sync_status] = (stats.bySyncStatus[order.sync_status] || 0) + 1;
      }
    });

    return stats;
  }
};
