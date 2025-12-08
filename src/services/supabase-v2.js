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
 * Servicio para gestionar transportadoras (carriers)
 */
export const carriersService = {
  /**
   * Obtener todas las transportadoras activas
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
 * Servicio para gestionar tiendas (stores)
 */
export const storesService = {
  /**
   * Obtener todas las tiendas activas
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
 * Servicio para gestionar operarios (operators)
 */
export const operatorsService = {
  /**
   * Obtener o crear operario por nombre
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
 * Servicio para gestionar códigos escaneados (codes)
 */
export const codesService = {
  /**
   * Obtener todos los códigos con información detallada
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
      byCarrier: {},
      byStore: {}
    };
    
    // Contar por transportadora
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
