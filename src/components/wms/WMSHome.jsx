// =====================================================
// WMS HOME - Dunamix Scanner
// =====================================================
// Pantalla principal del módulo WMS
// Glassmorphism + Cards de navegación
// =====================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { UnifiedDashboard } from './UnifiedDashboard'; // Dashboard único
import { QrCode, Package, Upload, FileEdit, ClipboardList, ArrowLeft, BarChart3, History, Settings } from 'lucide-react';

export function WMSHome() {
  const navigate = useNavigate();
  const operator = useStore((state) => state.operator);
  const selectedWarehouse = useStore((state) => state.selectedWarehouse);

  // Si no hay almacén seleccionado, redirigir a selector (en useEffect)
  useEffect(() => {
    // Dar tiempo a Zustand para cargar desde localStorage
    const timer = setTimeout(() => {
      if (!selectedWarehouse) {
        console.log('⚠️ WMSHome: No hay almacén seleccionado - redirigiendo...');
        navigate('/wms/select-warehouse');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedWarehouse, navigate]);

  // Mientras carga Zustand, mostrar loading o nada
  if (!selectedWarehouse) {
    return null;
  }

  const cards = [
    {
      id: 'dashboard',
      icon: BarChart3,
      title: 'Dashboard',
      description: 'Despachos del día',
      path: '/wms/dashboard',
      gradient: 'from-blue-500/10 to-cyan-500/10'
    },
    {
      id: 'scan-guide',
      icon: QrCode,
      title: 'Escanear Guía',
      description: 'Despacho de pedidos',
      path: '/wms/scan-guide',
      gradient: 'from-primary-500/10 to-cyan-500/10'
    },
    {
      id: 'receipt',
      icon: Package,
      title: 'Entrada',
      description: 'Recibir inventario',
      path: '/wms/receipt',
      gradient: 'from-green-500/10 to-emerald-500/10'
    },
    {
      id: 'adjustment',
      icon: FileEdit,
      title: 'Ajuste',
      description: 'Corregir inventario',
      path: '/wms/adjustment',
      gradient: 'from-orange-500/10 to-amber-500/10'
    },
    {
      id: 'inventory',
      icon: ClipboardList,
      title: 'Inventario',
      description: 'Ver stock actual',
      path: '/wms/inventory',
      gradient: 'from-purple-500/10 to-pink-500/10'
    },
    {
      id: 'import-csv',
      icon: Upload,
      title: 'Importar CSV',
      description: 'Interrápidisimo',
      path: '/wms/import-csv',
      gradient: 'from-indigo-500/10 to-purple-500/10'
    },
    {
      id: 'history',
      icon: History,
      title: 'Historial',
      description: 'Escaneos y trazabilidad',
      path: '/wms/history',
      gradient: 'from-purple-500/10 to-pink-500/10'
    },
    {
      id: 'manage-warehouses',
      icon: Settings,
      title: 'Gestionar Almacenes',
      description: 'Crear, editar, eliminar',
      path: '/wms/manage-warehouses',
      gradient: 'from-slate-500/10 to-gray-500/10'
    },
    {
      id: 'manage-products',
      icon: Package,
      title: 'Gestionar Productos',
      description: 'Crear, editar, eliminar',
      path: '/wms/manage-products',
      gradient: 'from-emerald-500/10 to-teal-500/10'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Dashboard
        </button>

        {/* Title Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
          <h1 className="text-3xl font-bold text-white mb-2">
            WMS - Gestión de Almacén
          </h1>
          <div className="flex items-center gap-4 text-white/60">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {operator}
            </span>
            <span>•</span>
            <span>{selectedWarehouse.name}</span>
            <button
              onClick={() => navigate('/wms/select-warehouse')}
              className="ml-auto text-xs px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10"
            >
              Cambiar almacén
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Único - Stats del almacén actual */}
      <div className="max-w-4xl mx-auto mb-8">
        <UnifiedDashboard warehouseId={selectedWarehouse.id} showTitle={false} />
      </div>

      {/* Cards Grid */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              onClick={() => navigate(card.path)}
              className={`
                group relative overflow-hidden
                bg-gradient-to-br ${card.gradient}
                backdrop-blur-xl rounded-3xl
                border border-white/10
                p-8
                shadow-glass-lg
                hover:shadow-glass-xl
                hover:scale-[1.02]
                transition-all duration-300
                text-left
              `}
            >
              {/* Icon */}
              <div className="flex items-start justify-between mb-4">
                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-xl group-hover:bg-white/20 transition-all">
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Arrow */}
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                  <svg
                    className="w-4 h-4 text-white/60 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Text */}
              <h3 className="text-xl font-bold text-white mb-2">
                {card.title}
              </h3>
              <p className="text-white/60 text-sm">
                {card.description}
              </p>

              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="max-w-4xl mx-auto mt-8 text-center text-white/40 text-sm">
        <p>Warehouse Management System - Fase 1</p>
        <p className="mt-1">Inventario basado en movimientos (ledger)</p>
      </div>
    </div>
  );
}

export default WMSHome;
