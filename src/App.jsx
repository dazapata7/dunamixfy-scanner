import { useState, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useStore } from "./store/useStore";
import { Toaster } from "react-hot-toast";
import "./App.css";

// V4: Code-Splitting - Lazy load de componentes pesados
// Esto reduce el bundle inicial de 862KB a ~200-300KB
const Login = lazy(() => import("./components/Login"));
const LoginAuth = lazy(() => import("./components/LoginAuth"));
const Dashboard = lazy(() => import("./components/Dashboard"));

// Componente interno que usa el hook useAuth
function AppContent() {
  const { user, loading } = useAuth();
  const operator = useStore((state) => state.operator);
  const [useRealAuth, setUseRealAuth] = useState(true); // Toggle para activar auth real

  // V4: Componente de loading reutilizable para Suspense y auth
  const LoadingScreen = ({ message = "Cargando..." }) => (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400 text-lg font-medium">{message}</p>
      </div>
    </div>
  );

  // Mostrar loading mientras verifica la sesión
  if (loading && useRealAuth) {
    return <LoadingScreen message="Verificando sesión..." />;
  }

  // Si está activada la autenticación real
  if (useRealAuth) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        {!user ? <LoginAuth /> : <Dashboard />}
      </Suspense>
    );
  }

  // Modo legacy (sin auth real)
  return (
    <Suspense fallback={<LoadingScreen />}>
      {!operator ? <Login /> : <Dashboard />}
    </Suspense>
  );
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
            background: "#1a1f2e",
            color: "#fff",
            border: "1px solid #00D9C0",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
          },
          success: {
            iconTheme: {
              primary: "#00D9C0",
              secondary: "#1a1f2e",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#1a1f2e",
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;
