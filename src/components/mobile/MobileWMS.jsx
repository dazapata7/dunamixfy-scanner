// =====================================================
// MOBILE WMS HOME - Solo para teléfonos (< 768px)
// =====================================================
// Vista simplificada: stats del día + botón escanear
// Tablet/Desktop → app completa con sidebar
// =====================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import { dispatchesService } from '../../services/wmsService';
import { QrCode, Package, Truck, BarChart3, LogOut, Warehouse, RefreshCw } from 'lucide-react';

export function MobileWMS() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const operator        = useStore((s) => s.operator);
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);

  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Si no hay bodega seleccionada, redirigir al selector
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedWarehouse) navigate('/wms/select-warehouse');
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedWarehouse, navigate]);

  useEffect(() => {
    if (selectedWarehouse) loadStats();
  }, [selectedWarehouse]);

  async function loadStats() {
    setIsLoading(true);
    try {
      const dispatches = await dispatchesService.getTodayDispatches(selectedWarehouse.id);

      const total = dispatches.length;
      let coordinadora = 0;
      let interrapidisimo = 0;
      let totalProducts = 0;

      dispatches.forEach(d => {
        const carrier = (d.carrier_name || '').toLowerCase();
        if (carrier.includes('coordinadora')) coordinadora++;
        else if (carrier.includes('interrapidisimo') || carrier.includes('inter')) interrapidisimo++;

        // Sumar productos
        if (d.dispatch_items) {
          totalProducts += d.dispatch_items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        }
      });

      setStats({ total, coordinadora, interrapidisimo, totalProducts });
    } catch (err) {
      console.warn('Error cargando stats móvil:', err.message);
      setStats({ total: 0, coordinadora: 0, interrapidisimo: 0, totalProducts: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  // Iniciales del operador
  const initials = operator
    ? operator.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500/40 to-indigo-500/40 border border-white/10 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">{operator || 'Operador'}</p>
            {selectedWarehouse && (
              <p className="text-white/40 text-xs mt-0.5 leading-none">{selectedWarehouse.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cambiar bodega */}
          <button
            onClick={() => navigate('/wms/select-warehouse')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 transition-all"
            title="Cambiar bodega"
          >
            <Warehouse className="w-4 h-4" />
          </button>
          {/* Logout */}
          <button
            onClick={signOut}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Stats del día */}
      <div className="px-5 py-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">Hoy</p>
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 border border-white/8 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Total guías */}
            <div className="col-span-2 p-4 rounded-2xl bg-gradient-to-br from-primary-500/15 to-cyan-500/10 border border-primary-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/20">
                  <BarChart3 className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-white/50 text-xs">Guías despachadas</p>
                  <p className="text-white text-3xl font-black leading-none mt-0.5">{stats?.total ?? 0}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-white/30 text-xs">Productos</p>
                  <p className="text-white/70 text-xl font-bold">{stats?.totalProducts ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Coordinadora */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <p className="text-blue-300/70 text-xs font-medium">Coordinadora</p>
              </div>
              <p className="text-white text-2xl font-black">{stats?.coordinadora ?? 0}</p>
            </div>

            {/* Interrápidisimo */}
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-orange-400" />
                <p className="text-orange-300/70 text-xs font-medium">Interrápidisimo</p>
              </div>
              <p className="text-white text-2xl font-black">{stats?.interrapidisimo ?? 0}</p>
            </div>
          </div>
        )}
      </div>

      {/* Botón principal de escaneo */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <button
          onClick={() => navigate('/wms/scan-guide')}
          className="w-full max-w-xs aspect-square rounded-3xl bg-gradient-to-br from-primary-500 to-cyan-500 shadow-2xl shadow-primary-500/30 flex flex-col items-center justify-center gap-4 active:scale-95 transition-all"
        >
          <QrCode className="w-20 h-20 text-dark-950" strokeWidth={1.5} />
          <span className="text-dark-950 font-black text-2xl">Escanear</span>
          <span className="text-dark-950/60 text-sm font-medium -mt-2">Toca para abrir cámara</span>
        </button>
      </div>

      {/* Footer info */}
      <div className="px-5 pb-safe pb-6 text-center">
        <p className="text-white/20 text-xs">Dunamix WMS · Solo escaneo desde móvil</p>
      </div>
    </div>
  );
}

export default MobileWMS;
