// =====================================================
// SIDEBAR LAYOUT - Dunamix WMS (Desktop/Tablet)
// =====================================================
// Visible solo en lg+ (hidden en móvil)
// Sidebar fijo a la izquierda con navegación por rol
// =====================================================

import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import {
  Package, Upload, ClipboardList,
  History, TrendingDown, Users, Warehouse, Shield,
  LogOut, User, BarChart3, Monitor, ChevronRight
} from 'lucide-react';

// ── Ítems de navegación por sección ──────────────────
function navItems(role) {
  const wms = [
    { icon: BarChart3,     label: 'Dashboard',        path: '/wms/dashboard' },
    { icon: Monitor,       label: 'Remote Scanner',   path: '/wms/remote-scanner/host' },
    { icon: History,       label: 'Historial',        path: '/wms/history' },
    { icon: Package,       label: 'Inventario',       path: '/wms/inventory' },
    { icon: TrendingDown,  label: 'Ajustes',          path: '/wms/adjustment' },
    { icon: Upload,        label: 'Importar CSV',     path: '/wms/import-csv' },
    { icon: ClipboardList, label: 'Recepción',        path: '/wms/receipt' },
    { icon: Package,       label: 'Productos',        path: '/wms/manage-products' },
    { icon: Warehouse,     label: 'Bodegas',          path: '/wms/manage-warehouses' },
  ];

  const admin = [
    { icon: Users,     label: 'Operadores',   path: '/admin/operadores' },
    { icon: Warehouse, label: 'Mis Bodegas',  path: '/admin/bodegas' },
  ];

  const superadmin = [
    { icon: Shield,   label: 'Super Admin', path: '/superadmin' },
  ];

  return {
    wmsItems: wms,
    adminItems: (role === 'admin' || role === 'superadmin') ? admin : [],
    superItems: role === 'superadmin' ? superadmin : [],
  };
}

// ── Ítem individual del sidebar ───────────────────────
function NavItem({ icon: Icon, label, path, active }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
        active
          ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
          : 'text-white/50 hover:text-white/90 hover:bg-white/5'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary-400' : 'text-white/40 group-hover:text-white/70'}`} />
      <span className="truncate">{label}</span>
      {active && <ChevronRight className="w-3 h-3 ml-auto text-primary-400/60" />}
    </button>
  );
}

// ── Sección con label ─────────────────────────────────
function NavSection({ label, children }) {
  return (
    <div className="mb-4">
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────
export function SidebarLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const operator   = useStore((s) => s.operator);
  const operatorId = useStore((s) => s.operatorId);
  const role       = useStore((s) => s.role);
  const companyName = useStore((s) => s.companyName);
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);

  const { wmsItems, adminItems, superItems } = navItems(role);

  // Iniciales para avatar
  const initials = operator
    ? operator.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  // Badge de rol
  const roleBadge = {
    superadmin: { label: 'Super Admin', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    admin:      { label: 'Admin',       cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    operator:   { label: 'Operador',    cls: 'bg-green-500/20  text-green-300  border-green-500/30'  },
  }[role] || { label: 'Usuario', cls: 'bg-white/10 text-white/50 border-white/20' };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 bg-dark-950/95 backdrop-blur-xl border-r border-white/8 z-40">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/8">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <span className="text-dark-950 font-black text-sm">D</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-none">Dunamix</p>
          <p className="text-white/40 text-[10px] mt-0.5 truncate">{companyName || 'WMS Scanner'}</p>
        </div>
      </div>

      {/* Nav items (scrollable) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">

        {/* Bodega activa */}
        {selectedWarehouse && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Bodega activa</p>
            <p className="text-white/80 text-xs font-medium truncate">{selectedWarehouse.name}</p>
            <button
              onClick={() => navigate('/wms/select-warehouse')}
              className="text-[10px] text-primary-400/70 hover:text-primary-300 mt-0.5 transition-colors"
            >
              Cambiar
            </button>
          </div>
        )}

        {/* WMS */}
        <NavSection label="WMS">
          {wmsItems.map((item) => (
            <NavItem key={item.path} {...item} active={isActive(item.path)} />
          ))}
        </NavSection>

        {/* Admin */}
        {adminItems.length > 0 && (
          <NavSection label="Administración">
            {adminItems.map((item) => (
              <NavItem key={item.path} {...item} active={isActive(item.path)} />
            ))}
          </NavSection>
        )}

        {/* SuperAdmin */}
        {superItems.length > 0 && (
          <NavSection label="Plataforma">
            {superItems.map((item) => (
              <NavItem key={item.path} {...item} active={isActive(item.path)} />
            ))}
          </NavSection>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/8 px-3 py-3">
        {/* Avatar + nombre */}
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500/40 to-indigo-500/40 border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white/90 text-sm font-medium truncate leading-none">{operator || 'Usuario'}</p>
            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${roleBadge.cls}`}>
              {roleBadge.label}
            </span>
          </div>
          <User className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 flex-shrink-0 transition-colors" />
        </button>

        {/* Logout */}
        <button
          onClick={signOut}
          className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarLayout;
