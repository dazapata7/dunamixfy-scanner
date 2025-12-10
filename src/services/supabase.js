import { createClient } from '@supabase/supabase-js';

// Obtener credenciales de las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Falta configuración de Supabase. Asegúrate de tener un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'
  );
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

/**
 * ============================================================================
 * SERVICIO DE TRANSPORTADORAS (CARRIERS) - V2
 * ============================================================================
 * Gestiona transportadoras desde la base de datos.
 * Permite cargar reglas de validación y configuración de extracción dinámicamente.
 *
 * Ventajas V2:
 * - Agregar nuevas transportadoras sin modificar código
 * - Cambiar reglas de validación vía SQL
 * - Configuración de extracción personalizada por transportadora
 */
export const carriersService = {
  /**
   * Obtener todas las transportadoras activas
   * Retorna solo las transportadoras con is_active = true
   */
  async getAll() {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (error) throw error;
    return data;
  },

  /**
   * Obtener transportadora por código
   * Útil para validar códigos escaneados contra una transportadora específica
   */
  async getByCode(code) {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Crear o actualizar transportadora
   * Permite gestión dinámica de transportadoras desde la aplicación
   */
  async upsert(carrierData) {
    const { data, error } = await supabase
      .from('carriers')
      .upsert([carrierData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

/**
 * ============================================================================
 * SERVICIO DE OPERARIOS (OPERATORS) - V2
 * ============================================================================
 * Gestiona operarios del sistema.
 * Actualizado para incluir is_active en la creación automática.
 */
export const operatorsService = {
  /**
   * Obtener o crear operario por nombre
   * Si no existe, lo crea automáticamente al hacer login
   */
  async getOrCreate(name) {
    // Primero intentar obtener
    let { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('name', name)
      .single();

    // Si no existe, crear
    if (error && error.code === 'PGRST116') {
      const { data: newData, error: createError } = await supabase
        .from('operators')
        .insert([{ name, is_active: true }])
        .select()
        .single();

      if (createError) throw createError;
      return newData;
    }

    if (error) throw error;
    return data;
  }
};

/**
 * ============================================================================
 * SERVICIO DE CÓDIGOS ESCANEADOS (CODES) - V3
 * ============================================================================
 * Gestiona códigos escaneados con caché mínimo de Dunamixfy.
 *
 * Cambios V3:
 * - Tabla codes simplificada: solo log transitorio + cache básico
 * - Dunamixfy es fuente única de verdad para orders/stores
 * - Retención 7 días (auto-limpieza programada)
 * - Cache: order_id, customer_name, carrier_name, store_name
 */
export const codesService = {
  /**
   * Obtener todos los códigos con información detallada
   * V3: Solo tabla codes con cache de Dunamixfy
   */
  async getAll() {
    const { data, error } = await supabase
      .from('codes')
      .select('*, carriers(display_name, code)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener códigos del día actual
   * V3: Solo tabla codes con cache de Dunamixfy
   */
  async getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('codes')
      .select('*, carriers(display_name, code)')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Verificar si un código ya existe
   */
  async exists(code) {
    const { data, error } = await supabase
      .from('codes')
      .select('id')
      .eq('code', code)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    return !!data;
  },

  /**
   * Crear nuevo código
   */
  async create(codeData) {
    const { data, error } = await supabase
      .from('codes')
      .insert([codeData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Obtener estadísticas del día
   * V3: Solo transportadoras (stores eliminado)
   */
  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('codes')
      .select('carrier_name')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    const stats = {
      total: data.length,
      byCarrier: {}
    };

    // Contar por transportadora dinámicamente
    data.forEach(item => {
      if (item.carrier_name) {
        stats.byCarrier[item.carrier_name] = (stats.byCarrier[item.carrier_name] || 0) + 1;
      }
    });

    return stats;
  },

  /**
   * Eliminar código por ID
   */
  async delete(id) {
    console.log('🗑️ Supabase delete - ID:', id);

    const { data, error } = await supabase
      .from('codes')
      .delete()
      .eq('id', id)
      .select(); // Agregamos select() para confirmar la eliminación

    if (error) {
      console.error('❌ Error de Supabase al eliminar:', error);
      throw error;
    }

    console.log('✅ Respuesta de Supabase:', data);
    return { success: true, data };
  },

  /**
   * Suscribirse a cambios en tiempo real
   */
  subscribeToChanges(callback) {
    const channel = supabase
      .channel('codes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'codes'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
