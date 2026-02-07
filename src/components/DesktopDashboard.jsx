import { useState } from 'react';
import { AdminPanel } from './AdminPanel';
import { ConfigPanel } from './ConfigPanel';
import { UnifiedDashboard } from './wms/UnifiedDashboard'; // Dashboard único con datos de dispatches
import { BarChart3, Settings, LogOut, User, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export function DesktopDashboard({ onLogout, isAdmin = false }) {
  const [activeView, setActiveView] = useState('stats'); // stats, config
  const { user, signOut } = useAuth(); // V5: Obtener usuario actual
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      try {
        // V5: Cerrar sesión real de Supabase Auth
        await signOut();

        // Ejecutar logout del store (si existe)
        if (onLogout) {
          onLogout();
        }

        // El listener onAuthStateChange del AuthProvider manejará la redirección
        // al cambiar user a null
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        toast.error('Error al cerrar sesión');
      }
    }
  };

  if (activeView === 'config') {
    return <ConfigPanel onBack={() => setActiveView('stats')} />;
  }

  if (activeView === 'stats') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 relative overflow-hidden">
        {/* Efectos de fondo decorativos */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        </div>

        {/* Header glassmorphism */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
          <div className="max-w-7xl mx-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-shrink-0">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-primary-200 to-white bg-clip-text text-transparent">
                  Panel de Administración
                </h1>
                <p className="text-sm text-gray-400 mt-2">Gestión y estadísticas del sistema en tiempo real</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
                {isAdmin && (
                  <button
                    onClick={() => setActiveView('config')}
                    className="flex items-center gap-3 px-6 py-3 backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white rounded-2xl transition-colors border border-white/20 shadow-glass flex-shrink-0"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Settings className="w-5 h-5" />
                    </div>
                    <span className="font-semibold whitespace-nowrap">Configuración del Sistema</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="p-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 text-gray-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/20 transition-colors shadow-glass flex-shrink-0"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-6 h-6" />
                </button>

                {/* Badge de usuario circular - compacto al final */}
                {user && (
                  <div className="relative">
                    {/* Círculo con borde gradiente */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 p-0.5 shadow-lg shadow-primary-500/30">
                      {/* Círculo interior oscuro */}
                      <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary-400" />
                      </div>
                    </div>

                    {/* Indicador de estado online - punto pequeño */}
                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-dark-900 shadow-lg shadow-green-500/50 animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto p-8">
          <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-6 mb-8`}>
            {/* Botón Estadísticas - Glassmorphism */}
            <button
              onClick={() => setActiveView('stats-detail')}
              className="group backdrop-blur-2xl bg-gradient-to-br from-primary-500/20 to-cyan-500/20 hover:from-primary-500/30 hover:to-cyan-500/30 p-6 rounded-2xl shadow-glass-lg transition-all duration-300 transform hover:scale-105 border border-primary-400/30 hover:border-primary-400/50 relative overflow-hidden"
            >
              {/* Efecto de brillo al hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>

              <div className="relative flex items-center justify-between">
                <div className="text-left">
                  <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center mb-4 group-hover:bg-primary-500/30 transition-all">
                    <BarChart3 className="w-9 h-9 text-primary-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Estadísticas Avanzadas</h2>
                  <p className="text-primary-100 text-base">Ver análisis detallado y reportes completos</p>
                </div>
                <div className="text-7xl opacity-10 group-hover:opacity-20 transition-opacity">📊</div>
              </div>
            </button>

            {/* Botón WMS - Glassmorphism */}
            <button
              onClick={() => navigate('/wms')}
              className="group backdrop-blur-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 p-6 rounded-2xl shadow-glass-lg transition-all duration-300 transform hover:scale-105 border border-orange-400/30 hover:border-orange-400/50 relative overflow-hidden"
            >
              {/* Efecto de brillo al hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>

              <div className="relative flex items-center justify-between">
                <div className="text-left">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-all">
                    <Package className="w-9 h-9 text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">WMS - Almacén</h2>
                  <p className="text-orange-100 text-base">Gestión de inventario y despachos</p>
                </div>
                <div className="text-7xl opacity-10 group-hover:opacity-20 transition-opacity">📦</div>
              </div>
            </button>

            {/* Botón Configuración - Solo para admins - Glassmorphism */}
            {isAdmin && (
              <button
                onClick={() => setActiveView('config')}
                className="group backdrop-blur-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 p-6 rounded-2xl shadow-glass-lg transition-all duration-300 transform hover:scale-105 border border-purple-400/30 hover:border-purple-400/50 relative overflow-hidden"
              >
                {/* Efecto de brillo al hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>

                <div className="relative flex items-center justify-between">
                  <div className="text-left">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-all">
                      <Settings className="w-9 h-9 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Configuración</h2>
                    <p className="text-purple-100 text-base">Gestionar tiendas, transportadoras y usuarios</p>
                  </div>
                  <div className="text-7xl opacity-10 group-hover:opacity-20 transition-opacity">⚙️</div>
                </div>
              </button>
            )}
          </div>

          {/* Vista de estadísticas en tiempo real - Dashboard Único */}
          {activeView === 'stats' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-primary-400" />
                Estadísticas en Tiempo Real
              </h2>
              <UnifiedDashboard showTitle={false} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de estadísticas detalladas (AdminPanel completo)
  if (activeView === 'stats-detail') {
    return <AdminPanel onBack={() => setActiveView('stats')} />;
  }

  return null;
}
