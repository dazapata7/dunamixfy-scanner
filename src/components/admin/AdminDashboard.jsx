// =====================================================
// ADMIN DASHBOARD - Dunamix WMS
// =====================================================
// Panel de administración para el Admin de una empresa
// Gestiona bodegas, operadores y ve estadísticas
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { companiesService } from '../../services/companiesService';
import { Building2, Warehouse, Users, ChevronRight, Settings, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { operator, companyId, companyName } = useStore();

  const [stats, setStats] = useState({ warehouses: 0, operators: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (companyId) loadStats();
  }, [companyId]);

  async function loadStats() {
    setIsLoading(true);
    try {
      const [warehouses, operators] = await Promise.all([
        companiesService.getWarehouses(companyId),
        companiesService.getOperators(companyId)
      ]);
      setStats({ warehouses: warehouses.length, operators: operators.length });
    } catch (err) {
      console.error('Error cargando stats:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const menuItems = [
    {
      icon: <Warehouse className="w-7 h-7 text-blue-400" />,
      label: 'Bodegas',
      description: `${stats.warehouses} bodegas registradas`,
      color: 'bg-blue-500/20',
      path: '/admin/bodegas'
    },
    {
      icon: <Users className="w-7 h-7 text-green-400" />,
      label: 'Operadores',
      description: `${stats.operators} operadores activos`,
      color: 'bg-green-500/20',
      path: '/admin/operadores'
    },
    {
      icon: <Settings className="w-7 h-7 text-purple-400" />,
      label: 'Configuración',
      description: 'Datos de la empresa',
      color: 'bg-purple-500/20',
      path: '/admin/configuracion'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/wms')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Panel Admin</h1>
            <p className="text-white/60 text-sm">{companyName}</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30">
            <span className="text-indigo-300 text-xs font-medium">Admin</span>
          </div>
        </div>

        {/* Company Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-500/20">
              <Building2 className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{companyName}</h2>
              <p className="text-white/60 text-sm">Administrado por {operator}</p>
            </div>
          </div>

          {!isLoading && (
            <div className="grid grid-cols-2 gap-4 mt-5">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-3xl font-bold text-blue-300">{stats.warehouses}</p>
                <p className="text-blue-200/60 text-xs mt-1">Bodegas</p>
              </div>
              <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-3xl font-bold text-green-300">{stats.operators}</p>
                <p className="text-green-200/60 text-xs mt-1">Operadores</p>
              </div>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left group"
            >
              <div className={`p-3 rounded-2xl ${item.color}`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">{item.label}</p>
                <p className="text-white/50 text-sm">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-all" />
            </button>
          ))}
        </div>

        {/* WMS Button */}
        <button
          onClick={() => navigate('/wms')}
          className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:shadow-lg transition-all"
        >
          Ir al WMS
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;
