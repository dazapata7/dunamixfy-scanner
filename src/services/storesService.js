import { supabase } from './supabase';

export const storesService = {
  // Obtener todas las tiendas
  async getAll() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Obtener solo tiendas activas
  async getActive() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Obtener una tienda por ID
  async getById(id) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Crear nueva tienda
  async create(store) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('stores')
      .insert([{
        ...store,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar tienda
  async update(id, updates) {
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar tienda (soft delete - marcar como inactiva)
  async delete(id) {
    const { data, error } = await supabase
      .from('stores')
      .update({ active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar permanentemente
  async hardDelete(id) {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
