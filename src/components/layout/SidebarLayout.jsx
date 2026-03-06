// =====================================================
// SIDEBAR LAYOUT - Dunamixfy WMS (Desktop/Tablet)
// =====================================================
// Visible solo en lg+ (hidden en móvil)
// Sidebar fijo a la izquierda, navegación por categorías
// =====================================================

import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import {
  BarChart3, Monitor, History, ArrowLeftRight,
  Package, PackagePlus, TrendingDown,
  Upload, Tag, Warehouse,
  Users, Shield,
  LogOut, User
} from 'lucide-react';

// ── Categorías de navegación ──────────────────────────
function buildSections(role) {
  return [
    {
      label: 'Despachos',
      items: [
        { icon: BarChart3, label: 'Dashboard',      path: '/wms/dashboard' },
        { icon: Monitor,   label: 'Remote Scanner', path: '/wms/remote-scanner/host' },
        { icon: History,   label: 'Historial',      path: '/wms/history' },
      ],
    },
    {
      label: 'Inventario',
      items: [
        { icon: Package,        label: 'Stock actual', path: '/wms/inventory' },
        { icon: PackagePlus,    label: 'Recepción',    path: '/wms/receipt' },
        { icon: TrendingDown,   label: 'Ajustes',      path: '/wms/adjustment' },
        { icon: ArrowLeftRight, label: 'Movimientos',  path: '/wms/inventory-history' },
      ],
    },
    {
      label: 'Importación',
      items: [
        { icon: Upload, label: 'Importar CSV', path: '/wms/import-csv' },
      ],
    },
    {
      label: 'Catálogo',
      items: [
        { icon: Tag,      label: 'Productos', path: '/wms/manage-products' },
        { icon: Warehouse, label: 'Bodegas',  path: '/wms/manage-warehouses' },
      ],
    },
    ...(role === 'admin' || role === 'superadmin' ? [{
      label: 'Administración',
      items: [
        { icon: Users,     label: 'Operadores',  path: '/admin/operadores' },
        { icon: Warehouse, label: 'Mis Bodegas', path: '/admin/bodegas' },
      ],
    }] : []),
    ...(role === 'superadmin' ? [{
      label: 'Plataforma',
      items: [
        { icon: Shield, label: 'Super Admin', path: '/superadmin' },
      ],
    }] : []),
  ];
}

// ── Ítem individual del sidebar ───────────────────────
function NavItem({ icon: Icon, label, path, active }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative overflow-hidden ${
        active
          ? 'bg-primary-500/[0.12] text-primary-400'
          : 'text-white/40 hover:text-white/75 hover:bg-white/[0.04]'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-primary-500" />
      )}
      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
        active ? 'text-primary-400' : 'text-white/30 group-hover:text-white/55'
      }`} />
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Sección con label ─────────────────────────────────
function NavSection({ label, children }) {
  return (
    <div className="mb-3">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/20">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────
export function SidebarLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { signOut } = useAuth();

  const operator          = useStore((s) => s.operator);
  const role              = useStore((s) => s.role);
  const companyName       = useStore((s) => s.companyName);
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);

  const sections = buildSections(role);

  const initials = operator
    ? operator.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const roleBadge = {
    superadmin: { label: 'Super Admin', cls: 'bg-yellow-500/15 text-yellow-400/80 border-yellow-500/20' },
    admin:      { label: 'Admin',       cls: 'bg-indigo-500/15 text-indigo-400/80 border-indigo-500/20' },
    operator:   { label: 'Operador',    cls: 'bg-primary-500/15 text-primary-400/80 border-primary-500/20' },
  }[role] || { label: 'Usuario', cls: 'bg-white/8 text-white/40 border-white/15' };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 bg-dark-950 border-r border-white/[0.06] z-40">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(0,229,191,0.35)]">
          <span className="text-dark-950 font-black text-sm tracking-tight">D</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-black text-sm leading-none tracking-wide uppercase">Dunamixfy</p>
          <p className="text-primary-500/60 text-[10px] mt-0.5 font-semibold tracking-[0.18em] uppercase">WMS · {companyName || 'Warehouse'}</p>
        </div>
      </div>

      {/* Nav (scrollable) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">

        {/* Bodega activa */}
        {selectedWarehouse && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-0.5">Bodega activa</p>
            <p className="text-white/70 text-xs font-medium truncate">{selectedWarehouse.name}</p>
            <button
              onClick={() => navigate('/wms/select-warehouse')}
              className="text-[10px] text-primary-500/60 hover:text-primary-400 mt-0.5 transition-colors"
            >
              Cambiar
            </button>
          </div>
        )}

        {/* Secciones dinámicas */}
        {sections.map((section) => (
          <NavSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <NavItem key={item.path} {...item} active={isActive(item.path)} />
            ))}
          </NavSection>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.06] px-3 py-3">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/[0.04] transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary-500/20 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-400 font-bold text-xs">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white/80 text-xs font-medium truncate leading-none">{operator || 'Usuario'}</p>
            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${roleBadge.cls}`}>
              {roleBadge.label}
            </span>
          </div>
          <User className="w-3 h-3 text-white/15 group-hover:text-white/35 flex-shrink-0 transition-colors" />
        </button>

        <button
          onClick={signOut}
          className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-all text-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarLayout;
