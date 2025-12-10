import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useRole } from '../hooks/useRole';
import { ZXingScanner as ScannerComponent } from './ZXingScanner';
import { Stats } from './Stats';
import { DesktopDashboard } from './DesktopDashboard';
import { Camera, LogOut, BarChart3, RefreshCw, ShieldAlert } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
import toast from 'react-hot-toast';

export function Dashboard() {
  const [showScanner, setShowScanner] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { isAdmin, isOperator, loading: loadingRole } = useRole();

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

  const handleLogout = () => {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      logout();
      toast.success('Sesión cerrada');
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
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
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
        <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-dark-800 rounded-2xl p-8 border border-red-500/30 text-center">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h1>
            <p className="text-gray-400 mb-6">
              El panel de escritorio requiere permisos de administrador u operador.
            </p>
            <button
              onClick={logout}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-800 border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              {operator}
              {isConnected && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-xs">En línea</span>
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-dark-700 text-gray-300 hover:text-white hover:bg-dark-600 transition-colors"
              title="Sincronizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-dark-700 text-gray-300 hover:text-red-400 hover:bg-dark-600 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Estadísticas de la sesión */}
        <div className="bg-dark-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            Resumen de tu Sesión
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark-700 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Escaneados</p>
              <p className="text-3xl font-bold text-primary-500">{sessionScans}</p>
            </div>
            
            <div className="bg-dark-700 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Repetidos</p>
              <p className="text-3xl font-bold text-red-400">{sessionRepeated}</p>
            </div>
          </div>
        </div>

        {/* Estadísticas del día */}
        <div className="bg-dark-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">
            Resumen de Hoy
          </h2>

          <div className="space-y-3">
            <div className="bg-dark-700 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Total del Día</p>
              <p className="text-3xl font-bold text-white">{todayScans}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-700 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">📦 Coordinadora</p>
                <p className="text-2xl font-bold text-blue-400">
                  {todayStats.coordinadora}
                </p>
              </div>

              <div className="bg-dark-700 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">⚡ Interrápidisimo</p>
                <p className="text-2xl font-bold text-purple-400">
                  {todayStats.interrapidisimo}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas por Tienda */}
        {todayStats.byStore && Object.keys(todayStats.byStore).length > 0 && (
          <div className="bg-dark-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">
              📊 Guías por Tienda (Hoy)
            </h2>

            <div className="space-y-2">
              {Object.entries(todayStats.byStore)
                .sort(([, a], [, b]) => b - a)
                .map(([store, count]) => (
                  <div key={store} className="bg-dark-700 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-gray-300 font-medium">{store}</span>
                    <span className="text-xl font-bold text-primary-500">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="space-y-3">
          <button
            onClick={() => setShowScanner(true)}
            className="w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-primary-500/50"
          >
            <Camera className="w-6 h-6" />
            <span className="text-lg">Escanear Códigos</span>
          </button>

          <button
            onClick={() => setShowStats(true)}
            className="w-full bg-dark-700 hover:bg-dark-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 border border-gray-600"
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-lg">Ver Estadísticas Completas</span>
          </button>
        </div>

        {/* Info */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>Dunamix Scanner v1.0</p>
          <p className="mt-1">React + Supabase • Tiempo Real</p>
        </div>
      </div>
    </div>
  );
}
