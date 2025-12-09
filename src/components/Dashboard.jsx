import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ZXingScanner as ScannerComponent } from './ZXingScanner';
import { Stats } from './Stats';
import { DesktopDashboard } from './DesktopDashboard';
// V2: Cambiado de StoreSelector a StoreSelectorV2 para cargar tiendas desde BD
import { StoreSelectorV2 as StoreSelector } from './StoreSelectorV2';
import { Camera, LogOut, BarChart3, RefreshCw, Store } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
import toast from 'react-hot-toast';

export function Dashboard() {
  const [showScanner, setShowScanner] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  
  const {
    operator,
    selectedStore,
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

  // Si es desktop, mostrar DesktopDashboard (panel de administración)
  if (isDesktop) {
    return <DesktopDashboard onLogout={logout} />;
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
        {/* Tienda seleccionada */}
        {selectedStore && (
          <div className="bg-dark-800 rounded-xl p-4 border border-primary-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Store className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Tienda actual</p>
                <p className="text-white font-semibold">{selectedStore}</p>
              </div>
            </div>
            <button
              onClick={() => setShowStoreSelector(true)}
              className="text-sm text-primary-500 hover:text-primary-400 font-medium"
            >
              Cambiar
            </button>
          </div>
        )}

        {/* Si no hay tienda, mostrar aviso */}
        {!selectedStore && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Store className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-200 font-medium">Sin tienda seleccionada</p>
                <p className="text-xs text-yellow-300/70 mt-1">Los códigos se guardarán sin tienda</p>
              </div>
              <button
                onClick={() => setShowStoreSelector(true)}
                className="text-sm text-yellow-400 hover:text-yellow-300 font-medium whitespace-nowrap"
              >
                Seleccionar
              </button>
            </div>
          </div>
        )}

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

          {/* Estadísticas por tienda */}
          {todayStats.byStore && Object.keys(todayStats.byStore).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-600">
              <p className="text-sm text-gray-400 mb-3">Por Tienda:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(todayStats.byStore).map(([store, count]) => (
                  <div key={store} className="bg-dark-600 rounded-lg p-3">
                    <p className="text-xs text-gray-400 truncate">{store}</p>
                    <p className="text-lg font-bold text-white">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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

      {/* Modal de selección de tienda */}
      {showStoreSelector && (
        <StoreSelector onClose={() => setShowStoreSelector(false)} />
      )}
    </div>
  );
}
