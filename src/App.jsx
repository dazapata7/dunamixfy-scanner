import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useStore } from './store/useStore';
import { Login } from './components/Login';
import { LoginAuth } from './components/LoginAuth';
import { Dashboard } from './components/Dashboard';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Componente interno que usa el hook useAuth
function AppContent() {
  const { user, loading } = useAuth();
  const operator = useStore((state) => state.operator);
  const [useRealAuth, setUseRealAuth] = useState(false); // Toggle para activar auth real

  // Mostrar loading mientras verifica la sesión
  if (loading && useRealAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Si está activada la autenticación real
  if (useRealAuth) {
    return !user ? <LoginAuth /> : <Dashboard />;
  }

  // Modo legacy (sin auth real)
  return !operator ? <Login /> : <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: '#1a1f2e',
            color: '#fff',
            border: '1px solid #00D9C0',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600'
          },
          success: {
            iconTheme: {
              primary: '#00D9C0',
              secondary: '#1a1f2e'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1a1f2e'
            }
          }
        }}
      />
    </AuthProvider>
  );
}

export default App;
