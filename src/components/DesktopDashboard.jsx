import { useState } from 'react';
import { AdminPanel } from './AdminPanel';
import { ConfigPanel } from './ConfigPanel';
import { BarChart3, Settings, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export function DesktopDashboard({ onLogout }) {
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
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        {/* Header */}
        <div className="bg-dark-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
              <p className="text-sm text-gray-400 mt-1">Gestión y estadísticas del sistema</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveView('config')}
                className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors border border-gray-600"
              >
                <Settings className="w-5 h-5" />
                Configuración del Sistema
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
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Botón Estadísticas */}
            <button
              onClick={() => setActiveView('stats-detail')}
              className="bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white p-8 rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-105 border-2 border-primary-400"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <BarChart3 className="w-12 h-12 mb-4" />
                  <h2 className="text-2xl font-bold">Estadísticas Avanzadas</h2>
                  <p className="text-primary-100 mt-2">Ver análisis detallado y reportes</p>
                </div>
                <div className="text-5xl font-bold opacity-20">📊</div>
              </div>
            </button>

            {/* Botón Configuración */}
            <button
              onClick={() => setActiveView('config')}
              className="bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white p-8 rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-105 border-2 border-gray-600"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <Settings className="w-12 h-12 mb-4" />
                  <h2 className="text-2xl font-bold">Configuración</h2>
                  <p className="text-gray-300 mt-2">Gestionar tiendas, transportadoras y usuarios</p>
                </div>
                <div className="text-5xl font-bold opacity-20">⚙️</div>
              </div>
            </button>
          </div>

          {/* Vista de estadísticas en tiempo real */}
          {activeView === 'stats' && (
            <div className="mt-6">
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
