import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useRole } from '../hooks/useRole';
import { ZXingScanner as ScannerComponent } from './ZXingScanner';
import { Stats } from './Stats';
import { DesktopDashboard } from './DesktopDashboard';
import { UnifiedDashboard } from './wms/UnifiedDashboard'; // Dashboard único con datos de dispatches
import { LogOut, BarChart3, RefreshCw, ShieldAlert, User, Package } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
import { useAuth } from '../hooks/useAuth'; // V5: Para obtener usuario y signOut real
import toast from 'react-hot-toast';

export function Dashboard() {
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { isAdmin, isOperator, loading: loadingRole } = useRole();
  const { user, signOut } = useAuth(); // V5: Obtener usuario actual y signOut real

  const {
    operator,
    logout,
    sessionScans,
    sessionRepeated,
    todayScans,
    todayStats
  } = useStore();

  const { isConnected, refresh } = useRealtime();

  // Detectar si es desktop
  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  const handleLogout = async () => {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      try {
        // V5: Cerrar sesión real de Supabase Auth
        await signOut();

        // Ejecutar logout del store (si existe)
        if (logout) {
          logout();
        }

        // El listener onAuthStateChange del AuthProvider manejará la redirección
        // al cambiar user a null
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        toast.error('Error al cerrar sesión');
      }
    }
  };

  const handleRefresh = async () => {
    toast.loading('Sincronizando...', { id: 'refresh' });
    await refresh();
    toast.success('Sincronizado', { id: 'refresh' });
  };

  // Si es desktop, verificar permisos antes de mostrar panel
  if (isDesktop) {
    // Si está cargando roles, mostrar loading
    if (loadingRole) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Verificando permisos...</p>
          </div>
        </div>
      );
    }

    // Si NO es admin NI operador, mostrar mensaje de acceso denegado
    if (!isAdmin && !isOperator) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-8 border border-red-400/30 text-center shadow-glass-lg">
            <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h1>
            <p className="text-gray-300 mb-6">
              El panel de escritorio requiere permisos de administrador u operador.
            </p>
            <button
              onClick={logout}
              className="w-full backdrop-blur-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-100 font-semibold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      );
    }

    // Mostrar panel (admin tiene acceso completo, operador solo estadísticas)
    return <DesktopDashboard onLogout={logout} isAdmin={isAdmin} />;
  }

  // Vista mobile normal
  if (showScanner) {
    return <ScannerComponent onBack={() => setShowScanner(false)} />;
  }

  if (showStats) {
    return <Stats onBack={() => setShowStats(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 relative overflow-hidden">
      {/* Efectos de fondo decorativos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header glassmorphism */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-2.5 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95 shadow-glass"
                title="Sincronizar"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 text-gray-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/20 transition-all hover:scale-110 active:scale-95 shadow-glass"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* Badge de usuario circular - compacto al final */}
              {user && (
                <div className="relative">
                  {/* Círculo con borde gradiente */}
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 p-0.5 shadow-lg shadow-primary-500/30">
                    {/* Círculo interior oscuro */}
                    <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-400" />
                    </div>
                  </div>

                  {/* Indicador de estado online - punto pequeño */}
                  {isConnected && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-dark-900 shadow-lg shadow-green-500/50 animate-pulse"></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-4xl mx-auto p-4 space-y-4">
        {/* Dashboard Único - Usando tabla dispatches */}
        <UnifiedDashboard showTitle={true} />

        {/* Botones de acción - Glassmorphism */}
        <div className="space-y-3 pb-6">
          {/* WMS Button - Principal */}
          <button
            onClick={() => navigate('/wms')}
            className="group w-full backdrop-blur-xl bg-gradient-to-r from-primary-500/90 to-cyan-500/90 hover:from-primary-500 hover:to-cyan-500 border border-primary-400/30 text-white font-bold py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-glass-lg hover:shadow-primary-500/50 hover:scale-105 active:scale-95"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all">
              <Package className="w-7 h-7" />
            </div>
            <span className="text-xl">WMS - Almacén</span>
          </button>

          <button
            onClick={() => setShowStats(true)}
            className="group w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white font-semibold py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 border border-white/20 shadow-glass hover:scale-105 active:scale-95"
          >
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
              <BarChart3 className="w-7 h-7" />
            </div>
            <span className="text-xl">Ver Estadísticas</span>
          </button>
        </div>

        {/* Info - Glassmorphism */}
        <div className="text-center text-sm text-gray-400 pb-4">
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 border border-white/10 inline-block">
            <p className="font-semibold text-gray-300">Dunamixfy Scanner v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// V4: Export default para lazy loading
export default Dashboard;
