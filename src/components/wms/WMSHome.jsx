// =====================================================
// WMS HOME - Dunamix Scanner
// =====================================================
// Pantalla principal del módulo WMS
// Design System Dunamixfy
// =====================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { UnifiedDashboard } from './UnifiedDashboard';
import {
  QrCode, Package, Upload, FileEdit, ClipboardList,
  ArrowLeft, BarChart3, History, Settings, TrendingDown,
  Monitor, Shield, Building2, ChevronRight
} from 'lucide-react';

export function WMSHome() {
  const navigate = useNavigate();
  const operator = useStore((state) => state.operator);
  const role = useStore((state) => state.role);
  const selectedWarehouse = useStore((state) => state.selectedWarehouse);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedWarehouse) {
        console.log('⚠️ WMSHome: No hay almacén seleccionado - redirigiendo...');
        navigate('/wms/select-warehouse');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedWarehouse, navigate]);

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
      accent: 'text-primary-400',
      iconBg: 'bg-primary-500/20',
    },
    {
      id: 'scan-guide',
      icon: QrCode,
      title: 'Escanear Guía',
      description: 'Despacho de pedidos',
      path: '/wms/scan-guide',
      accent: 'text-primary-400',
      iconBg: 'bg-primary-500/20',
    },
    {
      id: 'remote-scanner',
      icon: Monitor,
      title: 'Remote Scanner',
      description: 'PC + Móvil conectado',
      path: '/wms/remote-scanner/host',
      accent: 'text-pink-400',
      iconBg: 'bg-pink-500/20',
    },
    {
      id: 'receipt',
      icon: Package,
      title: 'Entrada',
      description: 'Recibir inventario',
      path: '/wms/receipt',
      accent: 'text-primary-400',
      iconBg: 'bg-primary-500/20',
    },
    {
      id: 'adjustment',
      icon: FileEdit,
      title: 'Ajuste',
      description: 'Corregir inventario',
      path: '/wms/adjustment',
      accent: 'text-orange-400',
      iconBg: 'bg-orange-500/20',
    },
    {
      id: 'inventory',
      icon: ClipboardList,
      title: 'Inventario',
      description: 'Ver stock actual',
      path: '/wms/inventory',
      accent: 'text-purple-400',
      iconBg: 'bg-purple-500/20',
    },
    {
      id: 'import-csv',
      icon: Upload,
      title: 'Importar CSV',
      description: 'Interrápidisimo',
      path: '/wms/import-csv',
      accent: 'text-indigo-400',
      iconBg: 'bg-indigo-500/20',
    },
    {
      id: 'history',
      icon: History,
      title: 'Historial',
      description: 'Escaneos y trazabilidad',
      path: '/wms/history',
      accent: 'text-cyan-400',
      iconBg: 'bg-cyan-500/20',
    },
    {
      id: 'inventory-history',
      icon: TrendingDown,
      title: 'Movimientos',
      description: 'Entradas y salidas',
      path: '/wms/inventory-history',
      accent: 'text-yellow-400',
      iconBg: 'bg-yellow-500/20',
    },
    {
      id: 'manage-warehouses',
      icon: Settings,
      title: 'Almacenes',
      description: 'Crear, editar, eliminar',
      path: '/wms/manage-warehouses',
      accent: 'text-white/50',
      iconBg: 'bg-white/[0.08]',
    },
    {
      id: 'manage-products',
      icon: Package,
      title: 'Productos',
      description: 'Crear, editar, eliminar',
      path: '/wms/manage-products',
      accent: 'text-primary-400',
      iconBg: 'bg-primary-500/20',
    }
  ];

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {role === 'superadmin' && (
              <button
                onClick={() => navigate('/superadmin')}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400/80 text-xs font-semibold hover:bg-yellow-500/20 transition-all gap-1.5"
              >
                <Shield className="w-3 h-3" /> Super Admin
              </button>
            )}
            {(role === 'admin' || role === 'superadmin') && (
              <button
                onClick={() => navigate('/admin')}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400/80 text-xs font-semibold hover:bg-primary-500/20 transition-all gap-1.5"
              >
                <Building2 className="w-3 h-3" /> Admin
              </button>
            )}
            <button
              onClick={() => navigate('/wms/select-warehouse')}
              className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-3 py-1.5 rounded-lg transition-all text-xs"
            >
              Cambiar almacén
            </button>
          </div>
        </div>

        {/* Title Card */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-white font-bold text-lg">WMS — Gestión de Almacén</h1>
              <div className="flex items-center gap-3 text-white/40 text-sm mt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                  {operator}
                </span>
                <span>·</span>
                <span>{selectedWarehouse.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Único - Stats del almacén actual */}
        <UnifiedDashboard warehouseId={selectedWarehouse.id} showTitle={false} />

        {/* Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-bold text-lg">Módulos</h2>
              <p className="text-white/40 text-sm mt-0.5">Selecciona una sección para comenzar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => navigate(card.path)}
                  className="group bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5 text-left hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                      <Icon className={`w-5 h-5 ${card.accent}`} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">{card.title}</h3>
                  <p className="text-white/40 text-xs">{card.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-white/25 text-xs pb-2">
          <p>Warehouse Management System · Fase 1 · Inventario basado en movimientos</p>
        </div>
      </div>
    </div>
  );
}

export default WMSHome;
