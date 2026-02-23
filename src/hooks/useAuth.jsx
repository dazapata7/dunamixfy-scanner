import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const { setOperator, setUserProfile, logout: logoutStore } = useStore();

  // Carga el perfil completo (role + empresa) después del login o restaurar sesión
  const loadUserProfile = async (userId) => {
    try {
      const { data: profile, error } = await supabase
        .rpc('get_user_profile', { p_user_id: userId });
      if (error) throw error;
      if (profile?.[0]) {
        const { role, company_id, company_name } = profile[0];
        setUserProfile(role, company_id, company_name);
        console.log(`🎭 Perfil cargado: role=${role}, empresa=${company_name || 'ninguna'}`);
      }
    } catch (err) {
      console.warn('⚠️ No se pudo cargar perfil de usuario:', err.message);
    }
  };

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Si hay sesión activa, guardar operador + perfil en Zustand
      if (session?.user) {
        const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuario';
        setOperator(userName, session.user.id);
        loadUserProfile(session.user.id);
        console.log('🧑 Operador guardado desde sesión inicial:', userName, session.user.id);
      }
    });

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth event:', event, session?.user?.email);

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // V6: Guardar operador en Zustand cuando se loguea
      if (event === 'SIGNED_IN' && session?.user) {
        const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuario';
        setOperator(userName, session.user.id);
        loadUserProfile(session.user.id);
        console.log('🧑 Operador guardado:', userName, session.user.id);
      }

      // V6: Limpiar operador de Zustand cuando se desloguea
      if (event === 'SIGNED_OUT') {
        logoutStore();
        toast.success('Sesión cerrada exitosamente');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login con email y contraseña
  const signInWithEmail = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Sincronizar operador manualmente (Migration 012)
      if (data.user) {
        try {
          const userName = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuario';
          await supabase.rpc('sync_operator_on_login', {
            user_id: data.user.id,
            user_email: data.user.email,
            user_name: userName
          });
          await loadUserProfile(data.user.id);
          console.log('✅ Operador sincronizado en login:', userName);
        } catch (syncError) {
          console.warn('⚠️ No se pudo sincronizar operador:', syncError);
          // No lanzar error, continuar con login
        }
      }

      toast.success('Sesión iniciada correctamente');
      return { data, error: null };
    } catch (error) {
      console.error('Error en login:', error);
      toast.error(error.message);
      return { data: null, error };
    }
  };

  // Registro con email y contraseña
  const signUpWithEmail = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata, // Nombre, rol, etc.
        },
      });

      if (error) throw error;

      // Sincronizar operador manualmente (Migration 012)
      if (data.user) {
        try {
          const userName = metadata.name || data.user.email?.split('@')[0] || 'Usuario';
          await supabase.rpc('sync_operator_on_login', {
            user_id: data.user.id,
            user_email: data.user.email,
            user_name: userName
          });
          await loadUserProfile(data.user.id);
          console.log('✅ Operador sincronizado en registro:', userName);
        } catch (syncError) {
          console.warn('⚠️ No se pudo sincronizar operador:', syncError);
          // No lanzar error, continuar con registro
        }
      }

      toast.success('Cuenta creada. Revisa tu email para confirmar.');
      return { data, error: null };
    } catch (error) {
      console.error('Error en registro:', error);
      toast.error(error.message);
      return { data: null, error };
    }
  };


  // Cerrar sesión
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // V5: No mostramos toast aquí, lo hace el listener onAuthStateChange
      return { error: null };
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      toast.error(error.message);
      return { error };
    }
  };

  // Resetear contraseña
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success('Revisa tu email para resetear tu contraseña');
      return { error: null };
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      toast.error(error.message);
      return { error };
    }
  };

  // Actualizar contraseña
  const updatePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Contraseña actualizada');
      return { error: null };
    } catch (error) {
      console.error('Error al actualizar contraseña:', error);
      toast.error(error.message);
      return { error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
