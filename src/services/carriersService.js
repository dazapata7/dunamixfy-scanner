import { supabase } from './supabase';

export const carriersService = {
  // Obtener todas las transportadoras
  async getAll() {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Obtener solo transportadoras activas
  async getActive() {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Obtener una transportadora por ID
  async getById(id) {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Crear nueva transportadora
  async create(carrier) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('carriers')
      .insert([{
        ...carrier,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar transportadora
  async update(id, updates) {
    const { data, error } = await supabase
      .from('carriers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar transportadora (soft delete - marcar como inactiva)
  async delete(id) {
    const { data, error } = await supabase
      .from('carriers')
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
      .from('carriers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
