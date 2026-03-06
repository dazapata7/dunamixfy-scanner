// =====================================================
// SIDEBAR LAYOUT - Dunamixfy WMS (Desktop/Tablet)
// =====================================================
// Visible solo en lg+ (hidden en móvil)
// Estilo Dunamixfy: items grandes, iconos teal, sin labels de sección
// =====================================================

import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import {
  BarChart3, Monitor, History, ArrowLeftRight,
  Package, PackagePlus, TrendingDown,
  Upload, Tag, Warehouse,
  Users, Shield,
  LogOut
} from 'lucide-react';

// ── Navegación agrupada (sin labels visibles, solo separadores) ──
function buildGroups(role) {
  return [
    [
      { icon: BarChart3,      label: 'Dashboard',      path: '/wms/dashboard' },
      { icon: Monitor,        label: 'Remote Scanner', path: '/wms/remote-scanner/host' },
      { icon: History,        label: 'Historial',      path: '/wms/history' },
    ],
    [
      { icon: Package,        label: 'Stock actual',   path: '/wms/inventory' },
      { icon: PackagePlus,    label: 'Recepción',      path: '/wms/receipt' },
      { icon: TrendingDown,   label: 'Ajustes',        path: '/wms/adjustment' },
      { icon: ArrowLeftRight, label: 'Movimientos',    path: '/wms/inventory-history' },
    ],
    [
      { icon: Upload,   label: 'Importar CSV', path: '/wms/import-csv' },
      { icon: Tag,      label: 'Productos',    path: '/wms/manage-products' },
      { icon: Warehouse, label: 'Bodegas',    path: '/wms/manage-warehouses' },
    ],
    ...(role === 'admin' || role === 'superadmin' ? [[
      { icon: Users,     label: 'Operadores',  path: '/admin/operadores' },
      { icon: Warehouse, label: 'Mis Bodegas', path: '/admin/bodegas' },
    ]] : []),
    ...(role === 'superadmin' ? [[
      { icon: Shield, label: 'Super Admin', path: '/superadmin' },
    ]] : []),
  ];
}

// ── Ítem individual — estilo Dunamixfy ────────────────
function NavItem({ icon: Icon, label, path, active }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold transition-all group relative ${
        active ? 'text-white' : 'text-white/40 hover:text-white/80'
      }`}
    >
      {/* Accent bar izquierdo */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary-500" />
      )}
      {/* Icono siempre teal */}
      <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
        active ? 'text-primary-400' : 'text-primary-500/35 group-hover:text-primary-400/65'
      }`} />
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Componente principal ──────────────────────────────
export function SidebarLayout() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const { signOut } = useAuth();

  const operator          = useStore((s) => s.operator);
  const role              = useStore((s) => s.role);
  const companyName       = useStore((s) => s.companyName);
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);

  const groups = buildGroups(role);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 bg-dark-950 border-r border-white/[0.06] z-40">

      {/* ── Logo ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(0,229,191,0.3)]">
            <span className="text-dark-950 font-black text-xs tracking-tight">D</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-xs leading-none tracking-widest uppercase">Dunamixfy</p>
            <p className="text-primary-500/50 text-[9px] mt-0.5 font-medium tracking-[0.2em] uppercase">WMS</p>
          </div>
        </div>
        {/* Bodega activa — chip compacto */}
        {selectedWarehouse && (
          <button
            onClick={() => navigate('/wms/select-warehouse')}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary-500/8 border border-primary-500/15 hover:bg-primary-500/15 transition-all"
            title={`Bodega: ${selectedWarehouse.name} · Cambiar`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
            <span className="text-primary-400/70 text-[10px] font-medium truncate max-w-[64px]">{selectedWarehouse.name}</span>
          </button>
        )}
      </div>

      {/* ── Nav (scrollable) ──────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {groups.map((group, gi) => (
          <div key={gi}>
            {/* Separador entre grupos (excepto el primero) */}
            {gi > 0 && (
              <div className="mx-4 my-1.5 border-t border-white/[0.04]" />
            )}
            {group.map((item) => (
              <NavItem key={item.path} {...item} active={isActive(item.path)} />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer — solo cerrar sesión ───────────────── */}
      <div className="border-t border-white/[0.06] px-3 py-3 flex-shrink-0">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/8 transition-all text-sm font-medium"
        >
          <LogOut className="w-[18px] h-[18px] text-red-500/40 group-hover:text-red-400 flex-shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarLayout;
