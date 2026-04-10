// =====================================================
// SIDEBAR LAYOUT - Dunamixfy WMS (Desktop/Tablet)
// =====================================================
// Estilo Dunamixfy: parent items expandables, active bg highlight
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import {
  BarChart3, Monitor, History, ArrowLeftRight,
  Package, PackagePlus, TrendingDown,
  Upload, Tag, Warehouse,
  Users, Shield, Settings,
  LogOut, ChevronDown, Factory, FolderOpen, RotateCcw, FlaskConical
} from 'lucide-react';

// ── Estructura de navegación ──────────────────────────
function buildNav(role) {
  return [
    // Standalone
    { icon: BarChart3, label: 'Dashboard',      path: '/wms/dashboard' },
    { icon: Monitor,   label: 'Remote Scanner', path: '/wms/remote-scanner/host' },
    { icon: History,   label: 'Historial',      path: '/wms/history' },
    // Expandable — Inventario
    {
      icon: Package,
      label: 'Inventario',
      children: [
        { icon: Package,        label: 'Stock actual', path: '/wms/inventory' },
        { icon: PackagePlus,    label: 'Recepción',    path: '/wms/receipt' },
        { icon: TrendingDown,   label: 'Ajustes',      path: '/wms/adjustment' },
        { icon: ArrowLeftRight, label: 'Movimientos',  path: '/wms/inventory-history' },
      ],
    },
    // Standalone — Productos
    { icon: Tag, label: 'Productos', path: '/wms/manage-products' },
    // Expandable — Producción
    {
      icon: Factory,
      label: 'Producción',
      children: [
        { icon: Factory,       label: 'Órdenes',   path: '/wms/production' },
        { icon: FlaskConical,  label: 'Insumos',   path: '/wms/manage-materials' },
        { icon: Tag,           label: 'Productos',  path: '/wms/production/products' },
        { icon: FolderOpen,    label: 'Categorías', path: '/wms/production/categories' },
      ],
    },
    // Standalone — Devoluciones
    { icon: RotateCcw, label: 'Devoluciones', path: '/wms/returns' },
    // Expandable — Configuración
    {
      icon: Settings,
      label: 'Configuración',
      children: [
        { icon: Upload,    label: 'Importar CSV', path: '/wms/import-csv' },
        { icon: Warehouse, label: 'Bodegas',      path: '/wms/manage-warehouses' },
      ],
    },
    // Expandable — Administración (admin+)
    ...(role === 'admin' || role === 'superadmin' ? [{
      icon: Users,
      label: 'Administración',
      children: [
        { icon: Users,     label: 'Operadores',  path: '/admin/operadores' },
        { icon: Warehouse, label: 'Mis Bodegas', path: '/admin/bodegas' },
      ],
    }] : []),
    // Standalone — Super Admin (superadmin)
    ...(role === 'superadmin' ? [
      { icon: Shield, label: 'Super Admin', path: '/superadmin' },
    ] : []),
  ];
}

// ── Sub-item ──────────────────────────────────────────
function SubItem({ icon: Icon, label, path, active }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-2.5 pl-9 pr-4 py-1.5 text-xs transition-all group ${
        active ? 'text-white/90' : 'text-white/35 hover:text-white/65'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
        active ? 'text-primary-400' : 'text-white/20 group-hover:text-primary-400/50'
      }`} />
      <span className={active ? 'font-semibold' : 'font-medium'}>{label}</span>
      {active && (
        <span className="ml-auto w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
      )}
    </button>
  );
}

// ── Nav item (standalone o expandable) ───────────────
function NavItem({ item, isActive, hasActiveChild, open, onToggle }) {
  const navigate  = useNavigate();
  const highlighted = isActive || hasActiveChild;

  if (!item.children) {
    return (
      <div className="px-2">
        <button
          onClick={() => navigate(item.path)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
            highlighted
              ? 'text-white'
              : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'
          }`}
        >
          <item.icon className={`w-[17px] h-[17px] flex-shrink-0 transition-colors ${
            highlighted ? 'text-primary-500' : 'text-white/25 group-hover:text-primary-500/60'
          }`} />
          <span className={`text-sm ${highlighted ? 'font-semibold' : 'font-medium'}`}>
            {item.label}
          </span>
          {highlighted && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />}
        </button>
      </div>
    );
  }

  // Expandable — accordion: solo uno abierto a la vez
  return (
    <div className="px-2">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
          open
            ? 'bg-white/[0.05] text-primary-500'
            : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'
        }`}
      >
        <item.icon className={`w-[17px] h-[17px] flex-shrink-0 transition-colors ${
          open ? 'text-primary-500' : 'text-white/25 group-hover:text-primary-500/60'
        }`} />
        <span className={`flex-1 text-left text-sm ${open ? 'font-semibold' : 'font-medium'}`}>
          {item.label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${
          open ? 'text-primary-500/60' : 'text-white/20 group-hover:text-white/40'
        } ${open ? 'rotate-0' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="mt-0.5 mb-1">
          {item.children.map(child => (
            <SubItem key={child.path} {...child} active={isActive === child.path} />
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
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);

  const pathname = location.pathname;
  const nav = buildNav(role);

  // Accordion: solo un menú expandible abierto a la vez.
  // Al cargar, abre el padre cuyo hijo esté activo.
  const activeParentLabel = nav.find(item =>
    item.children?.some(c => pathname === c.path || pathname.startsWith(c.path + '/'))
  )?.label || null;

  const [openLabel, setOpenLabel] = useState(activeParentLabel);

  // Si la ruta cambia, sincronizar el ítem abierto.
  // Si la ruta activa NO pertenece a ningún menú expandible, cerrar el que esté abierto.
  useEffect(() => {
    const parent = nav.find(item =>
      item.children?.some(c => pathname === c.path || pathname.startsWith(c.path + '/'))
    );
    if (parent) setOpenLabel(parent.label);
    else setOpenLabel(null);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle(label) {
    setOpenLabel(prev => (prev === label ? null : label));
  }

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-48 bg-dark-900 border-r border-white/[0.06] z-40">

      {/* ── Logo ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/[0.06] flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_14px_rgba(212,146,10,0.40)]">
          <span className="text-dark-950 font-black text-[11px]">D</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-black text-[12px] leading-none tracking-widest uppercase">Dunamixfy</p>
          <p className="text-primary-500/40 text-[8px] mt-1 font-semibold tracking-[0.20em] uppercase">WMS</p>
        </div>
      </div>

      {/* ── Bodega activa ─────────────────────────────── */}
      {selectedWarehouse && (
        <button
          onClick={() => navigate('/wms/select-warehouse')}
          className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500/[0.07] border border-primary-500/[0.10] hover:bg-primary-500/[0.12] transition-all text-left"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
          <p className="text-primary-400/65 text-[10px] font-medium truncate leading-none">{selectedWarehouse.name}</p>
        </button>
      )}

      {/* ── Nav ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
        {nav.map((item) => {
          const isStandaloneActive = !item.children && (pathname === item.path || pathname.startsWith(item.path + '/'));
          // Ordenar hijos por longitud de ruta desc para que rutas más específicas
          // (/wms/production/products) ganen sobre prefijos cortos (/wms/production)
          const activeChild = item.children
            ? [...item.children]
                .sort((a, b) => b.path.length - a.path.length)
                .find(c => pathname === c.path || pathname.startsWith(c.path + '/'))
            : null;

          return (
            <NavItem
              key={item.path || item.label}
              item={item}
              isActive={item.children ? (activeChild ? activeChild.path : false) : isStandaloneActive}
              hasActiveChild={!!activeChild}
              open={item.children ? openLabel === item.label : undefined}
              onToggle={item.children ? () => handleToggle(item.label) : undefined}
            />
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="border-t border-white/[0.05] px-3 py-3 flex-shrink-0">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-500/35 hover:text-red-400 hover:bg-red-500/[0.07] transition-all text-sm font-medium"
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
          <span className="text-sm">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default SidebarLayout;
