import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
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

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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

      toast.success('Cuenta creada. Revisa tu email para confirmar.');
      return { data, error: null };
    } catch (error) {
      console.error('Error en registro:', error);
      toast.error(error.message);
      return { data: null, error };
    }
  };

  // Login con Google
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error en login con Google:', error);
      toast.error(error.message);
      return { data: null, error };
    }
  };

  // Cerrar sesión
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast.success('Sesión cerrada');
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
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
