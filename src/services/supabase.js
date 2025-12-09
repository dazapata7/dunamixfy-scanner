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
 * SERVICIO DE TIENDAS (STORES) - V2
 * ============================================================================
 * Gestiona tiendas desde la base de datos.
 * Reemplaza la lista hardcoded de tiendas por carga dinámica desde BD.
 *
 * Ventajas V2:
 * - Agregar/editar tiendas sin modificar código
 * - CRUD completo desde la UI
 * - Escalabilidad ilimitada
 */
export const storesService = {
  /**
   * Obtener todas las tiendas activas
   * Usado en StoreSelectorV2 para mostrar opciones disponibles
   */
  async getAll() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Obtener o crear tienda por nombre
   * Si no existe, la crea automáticamente (útil para migración)
   */
  async getOrCreate(name) {
    // Primero intentar obtener
    let { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('name', name)
      .single();

    // Si no existe, crear
    if (error && error.code === 'PGRST116') {
      const { data: newData, error: createError } = await supabase
        .from('stores')
        .insert([{ name, is_active: true }])
        .select()
        .single();

      if (createError) throw createError;
      return newData;
    }

    if (error) throw error;
    return data;
  },

  /**
   * Crear nueva tienda
   * Para uso en panel de administración
   */
  async create(storeData) {
    const { data, error } = await supabase
      .from('stores')
      .insert([storeData])
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
 * SERVICIO DE CÓDIGOS ESCANEADOS (CODES) - V2
 * ============================================================================
 * Gestiona códigos escaneados con relaciones a transportadoras, tiendas y operarios.
 *
 * Cambios V2:
 * - Usa vista 'codes_detailed' para obtener información completa con JOINs
 * - getTodayStats() ahora genera byCarrier dinámicamente (no hardcoded)
 * - Soporte para múltiples transportadoras sin límite
 */
export const codesService = {
  /**
   * Obtener todos los códigos con información detallada
   * V2: Usa la vista 'codes_detailed' que incluye JOINs con carriers, stores y operators
   */
  async getAll() {
    const { data, error } = await supabase
      .from('codes_detailed')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener códigos del día actual
   * V2: Usa la vista 'codes_detailed' para tener información completa
   */
  async getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('codes_detailed')
      .select('*')
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
   * V2: Genera byCarrier dinámicamente en lugar de hardcoded (coordinadora, interrapidisimo)
   * Ahora soporta cualquier cantidad de transportadoras sin modificar código
   */
  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('codes_detailed')
      .select('carrier_code, carrier_display_name, store_name')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    const stats = {
      total: data.length,
      byCarrier: {}, // V2: Dinámico en lugar de hardcoded
      byStore: {}
    };

    // V2: Contar por transportadora dinámicamente
    data.forEach(item => {
      if (item.carrier_display_name) {
        const key = item.carrier_code;
        stats.byCarrier[key] = (stats.byCarrier[key] || 0) + 1;
      }
    });

    // Contar por tienda
    data.forEach(item => {
      if (item.store_name) {
        stats.byStore[item.store_name] = (stats.byStore[item.store_name] || 0) + 1;
      }
    });

    return stats;
  },

  /**
   * Eliminar código por ID
   */
  async delete(id) {
    const { error } = await supabase
      .from('codes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
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
