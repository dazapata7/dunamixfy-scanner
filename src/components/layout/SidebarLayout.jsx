// =====================================================
// SIDEBAR LAYOUT - Dunamixfy WMS (Desktop/Tablet)
// =====================================================
// Estilo Dunamixfy: w-44 (176px), categorías colapsables
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import {
  BarChart3, Monitor, History, ArrowLeftRight,
  Package, PackagePlus, TrendingDown,
  Upload, Tag, Warehouse,
  Users, Shield,
  LogOut, ChevronDown
} from 'lucide-react';

// ── Grupos de navegación por categoría ───────────────
function buildCategories(role) {
  const categories = [
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
      label: 'Ajustes WMS',
      items: [
        { icon: Upload,    label: 'Importar CSV', path: '/wms/import-csv' },
        { icon: Tag,       label: 'Productos',    path: '/wms/manage-products' },
        { icon: Warehouse, label: 'Bodegas',      path: '/wms/manage-warehouses' },
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
  return categories;
}

// ── Ítem — solo color change al activarse ────────────
function NavItem({ icon: Icon, label, path, active }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-all group ${
        active ? 'text-white' : 'text-white/40 hover:text-white/75'
      }`}
    >
      <Icon className={`w-[16px] h-[16px] flex-shrink-0 transition-colors ${
        active ? 'text-primary-400' : 'text-primary-500/30 group-hover:text-primary-400/55'
      }`} />
      <span className={`truncate text-xs ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

// ── Categoría colapsable ──────────────────────────────
function NavCategory({ label, items, defaultOpen, isActive }) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-abrir si contiene la ruta activa
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 group"
      >
        <span className={`text-[9.5px] font-semibold tracking-[0.14em] uppercase transition-colors ${
          isActive ? 'text-white/50' : 'text-white/20 group-hover:text-white/35'
        }`}>
          {label}
        </span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-all ${
          isActive ? 'text-white/40' : 'text-white/15 group-hover:text-white/30'
        } ${open ? 'rotate-0' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="pb-1">
          {items.map(item => (
            <NavItem key={item.path} {...item} active={item.active} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────
export function SidebarLayout() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const { signOut } = useAuth();

  const role              = useStore((s) => s.role);
  const companyName       = useStore((s) => s.companyName);
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const categories = buildCategories(role).map(cat => ({
    ...cat,
    items: cat.items.map(item => ({ ...item, active: isActive(item.path) })),
  }));

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-44 bg-dark-950 border-r border-white/[0.06] z-40">

      {/* ── Logo ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/[0.06] flex-shrink-0">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(0,229,191,0.3)]">
          <span className="text-dark-950 font-black text-[10px]">D</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-black text-[11px] leading-none tracking-widest uppercase">Dunamixfy</p>
          <p className="text-primary-500/45 text-[8.5px] mt-0.5 font-semibold tracking-[0.18em] uppercase">
            {companyName || 'WMS'}
          </p>
        </div>
      </div>

      {/* ── Bodega activa (si hay) ─────────────────────── */}
      {selectedWarehouse && (
        <button
          onClick={() => navigate('/wms/select-warehouse')}
          className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500/[0.07] border border-primary-500/[0.12] hover:bg-primary-500/[0.12] transition-all text-left"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
          <p className="text-primary-400/70 text-[10px] font-medium truncate leading-none">{selectedWarehouse.name}</p>
        </button>
      )}

      {/* ── Nav (scrollable) ──────────────────────────── */}
      <nav className="flex-1 overflow-y-auto pt-2 pb-2 scrollbar-thin">
        {categories.map((cat, ci) => (
          <div key={ci}>
            {ci > 0 && <div className="mx-4 my-1.5 border-t border-white/[0.04]" />}
            <NavCategory
              label={cat.label}
              items={cat.items}
              defaultOpen={ci === 0}
              isActive={cat.items.some(i => i.active)}
            />
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="border-t border-white/[0.06] px-3 py-3 flex-shrink-0">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-red-500/40 hover:text-red-400 hover:bg-red-500/[0.07] transition-all text-sm font-medium"
        >
          <LogOut className="w-[16px] h-[16px] flex-shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarLayout;
