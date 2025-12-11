import { useState } from 'react';
import { AdminPanel } from './AdminPanel';
import { ConfigPanel } from './ConfigPanel';
import { BarChart3, Settings, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export function DesktopDashboard({ onLogout, isAdmin = false }) {
  const [activeView, setActiveView] = useState('stats'); // stats, config

  const handleLogout = () => {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      onLogout();
      toast.success('Sesión cerrada');
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
          <div className="max-w-7xl mx-auto p-6 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-primary-200 to-white bg-clip-text text-transparent">
                Panel de Administración
              </h1>
              <p className="text-sm text-gray-400 mt-2">Gestión y estadísticas del sistema en tiempo real</p>
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => setActiveView('config')}
                  className="flex items-center gap-3 px-6 py-3 backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white rounded-2xl transition-all border border-white/20 shadow-glass hover:scale-105 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">Configuración del Sistema</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="p-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 text-gray-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/20 transition-all hover:scale-110 active:scale-95 shadow-glass"
                title="Cerrar sesión"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto p-8">
          <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-8 mb-8`}>
            {/* Botón Estadísticas - Glassmorphism */}
            <button
              onClick={() => setActiveView('stats-detail')}
              className="group backdrop-blur-2xl bg-gradient-to-br from-primary-500/20 to-cyan-500/20 hover:from-primary-500/30 hover:to-cyan-500/30 p-10 rounded-3xl shadow-glass-lg transition-all duration-300 transform hover:scale-105 border border-primary-400/30 hover:border-primary-400/50 relative overflow-hidden"
            >
              {/* Efecto de brillo al hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>

              <div className="relative flex items-center justify-between">
                <div className="text-left">
                  <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center mb-6 group-hover:bg-primary-500/30 transition-all">
                    <BarChart3 className="w-9 h-9 text-primary-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-3">Estadísticas Avanzadas</h2>
                  <p className="text-primary-100 text-lg">Ver análisis detallado y reportes completos</p>
                </div>
                <div className="text-7xl opacity-10 group-hover:opacity-20 transition-opacity">📊</div>
              </div>
            </button>

            {/* Botón Configuración - Solo para admins - Glassmorphism */}
            {isAdmin && (
              <button
                onClick={() => setActiveView('config')}
                className="group backdrop-blur-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 p-10 rounded-3xl shadow-glass-lg transition-all duration-300 transform hover:scale-105 border border-purple-400/30 hover:border-purple-400/50 relative overflow-hidden"
              >
                {/* Efecto de brillo al hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 group-hover:translate-x-full transition-transform duration-1000"></div>

                <div className="relative flex items-center justify-between">
                  <div className="text-left">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 group-hover:bg-purple-500/30 transition-all">
                      <Settings className="w-9 h-9 text-purple-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">Configuración</h2>
                    <p className="text-purple-100 text-lg">Gestionar tiendas, transportadoras y usuarios</p>
                  </div>
                  <div className="text-7xl opacity-10 group-hover:opacity-20 transition-opacity">⚙️</div>
                </div>
              </button>
            )}
          </div>

          {/* Vista de estadísticas en tiempo real - Glassmorphism wrapper */}
          {activeView === 'stats' && (
            <div className="backdrop-blur-2xl bg-gradient-to-br from-white/5 to-white/2 rounded-3xl border border-white/10 shadow-glass-lg overflow-hidden">
              <AdminPanel onBack={() => {}} hideBackButton />
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
