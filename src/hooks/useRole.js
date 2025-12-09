import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabase';

export function useRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setIsAdmin(false);
      setIsOperator(false);
      setLoading(false);
      return;
    }

    loadUserRoles();
  }, [user]);

  const loadUserRoles = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      const userRoles = data.map(r => r.role);
      setRoles(userRoles);
      setIsAdmin(userRoles.includes('admin'));
      setIsOperator(userRoles.includes('operator'));

      console.log('👤 Roles del usuario:', userRoles);
    } catch (error) {
      console.error('Error cargando roles:', error);
      setRoles([]);
      setIsAdmin(false);
      setIsOperator(false);
    } finally {
      setLoading(false);
    }
  };

  // Asignar rol a un usuario (solo admins)
  const assignRole = async (userId, role) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role, created_by: user.id }]);

      if (error) throw error;

      console.log(`✅ Rol ${role} asignado a usuario ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error asignando rol:', error);
      return { success: false, error };
    }
  };

  // Remover rol de un usuario (solo admins)
  const removeRole = async (userId, role) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      console.log(`✅ Rol ${role} removido de usuario ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error removiendo rol:', error);
      return { success: false, error };
    }
  };

  // Obtener todos los usuarios con sus roles (solo admins)
  const getAllUsersWithRoles = async () => {
    try {
      // Primero obtener todos los usuarios de auth
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) throw authError;

      // Luego obtener todos los roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combinar usuarios con sus roles
      const usersWithRoles = authUsers.users.map(user => {
        const userRoles = rolesData
          .filter(r => r.user_id === user.id)
          .map(r => r.role);

        return {
          ...user,
          roles: userRoles,
          isAdmin: userRoles.includes('admin'),
          isOperator: userRoles.includes('operator')
        };
      });

      return { success: true, data: usersWithRoles };
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return { success: false, error };
    }
  };

  return {
    roles,
    isAdmin,
    isOperator,
    loading,
    assignRole,
    removeRole,
    getAllUsersWithRoles,
    refresh: loadUserRoles
  };
}
