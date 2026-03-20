// =====================================================
// COMPANIES SERVICE - Dunamix WMS Multi-Tenant
// =====================================================
// Gestión de empresas/tenants y sus operadores/bodegas
// =====================================================

import { supabase } from './supabase';

export const companiesService = {
  // ─── COMPANIES ────────────────────────────────────

  /** Registrar empresa y convertir al usuario en Admin */
  async registerCompany(userId, companyName, companyEmail = null) {
    const { data, error } = await supabase
      .rpc('register_company', {
        p_user_id: userId,
        p_company_name: companyName,
        p_company_email: companyEmail
      });
    if (error) throw error;
    return data; // UUID de la empresa creada
  },

  /** Obtener empresa por ID */
  async getById(companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    if (error) throw error;
    return data;
  },

  /** Obtener todas las empresas (SuperAdmin) */
  async getAll() {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  /** Actualizar datos de empresa */
  async update(companyId, updates) {
    const { data, error } = await supabase
      .from('companies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', companyId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ─── OPERATORS POR EMPRESA ────────────────────────

  /** Obtener operadores de una empresa */
  async getOperators(companyId) {
    const { data, error } = await supabase
      .from('operators')
      .select(`
        id, name, email, role, is_active, permissions, created_at,
        operator_warehouses(warehouse_id, warehouses(id, name, code))
      `)
      .eq('company_id', companyId)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  /** Asignar operador a empresa y bodegas (Admin invita a usuario existente) */
  async assignOperatorToCompany(adminId, operatorUserId, warehouseIds = []) {
    // Obtener info del nuevo operador
    const { data: opData } = await supabase
      .from('operators')
      .select('name, email')
      .eq('id', operatorUserId)
      .single();

    const { error } = await supabase.rpc('create_operator_for_company', {
      p_admin_id: adminId,
      p_new_user_id: operatorUserId,
      p_name: opData?.name || null,
      p_email: opData?.email || null,
      p_warehouse_ids: warehouseIds.length > 0 ? warehouseIds : null
    });
    if (error) throw error;
  },

  /** Actualizar bodegas asignadas a un operador */
  async setOperatorWarehouses(operatorId, warehouseIds) {
    // 1. Eliminar asignaciones actuales
    const { error: delError } = await supabase
      .from('operator_warehouses')
      .delete()
      .eq('operator_id', operatorId);
    if (delError) throw delError;

    // 2. Insertar nuevas asignaciones
    if (warehouseIds.length > 0) {
      const { error: insError } = await supabase
        .from('operator_warehouses')
        .insert(warehouseIds.map(wId => ({ operator_id: operatorId, warehouse_id: wId })));
      if (insError) throw insError;
    }
  },

  /** Obtener bodegas a las que tiene acceso un operador */
  async getOperatorWarehouses(operatorId) {
    const { data, error } = await supabase
      .from('operator_warehouses')
      .select('warehouses(id, name, code, is_active)')
      .eq('operator_id', operatorId);
    if (error) throw error;
    return (data || []).map(r => r.warehouses).filter(Boolean);
  },

  /** Desactivar operador (sin eliminar) */
  async deactivateOperator(operatorId) {
    const { error } = await supabase
      .from('operators')
      .update({ is_active: false })
      .eq('id', operatorId);
    if (error) throw error;
  },

  /** Reactivar operador */
  async reactivateOperator(operatorId) {
    const { error } = await supabase
      .from('operators')
      .update({ is_active: true })
      .eq('id', operatorId);
    if (error) throw error;
  },

  // ─── BODEGAS POR EMPRESA ──────────────────────────

  /** Obtener bodegas de una empresa */
  async getWarehouses(companyId) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  /** Crear bodega para una empresa */
  async createWarehouse(companyId, warehouseData) {
    const { data, error } = await supabase
      .from('warehouses')
      .insert([{ ...warehouseData, company_id: companyId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Actualizar bodega */
  async updateWarehouse(warehouseId, updates) {
    const { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', warehouseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ─── SUPERADMIN ───────────────────────────────────

  /** Cambiar rol de un operador — usa RPC con validaciones de seguridad (migration 040) */
  async setOperatorRole(operatorId, role) {
    const { data, error } = await supabase.rpc('update_operator_role', {
      p_operator_id: operatorId,
      p_new_role: role
    });
    if (error) throw error;
    return data;
  },

  /** Actualizar permisos granulares de un operador — usa RPC (migration 040) */
  async updateOperatorPermissions(operatorId, permissions) {
    const { data, error } = await supabase.rpc('update_operator_permissions', {
      p_operator_id: operatorId,
      p_permissions: permissions
    });
    if (error) throw error;
    return data;
  },

  /** Obtener todos los operadores (SuperAdmin) */
  async getAllOperators() {
    const { data, error } = await supabase
      .from('operators')
      .select(`
        id, name, email, role, is_active, created_at, company_id,
        companies(name)
      `)
      .order('role')
      .order('name');
    if (error) throw error;
    return data || [];
  }
};

export default companiesService;
