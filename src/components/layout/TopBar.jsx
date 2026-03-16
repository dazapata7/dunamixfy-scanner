// =====================================================
// TOP BAR - Dunamixfy WMS (Desktop/Tablet)
// =====================================================
// Estilo Dunamixfy: logo + chevron + icono sección + título/desc
// =====================================================

import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  BarChart3, Monitor, History, ArrowLeftRight,
  Package, PackagePlus, TrendingDown,
  Upload, Tag, Warehouse,
  Users, Shield, User, MapPin, QrCode, Layers, Factory, FolderOpen, RotateCcw
} from 'lucide-react';

const ROUTE_META = {
  '/wms/dashboard':           { title: 'Dashboard',              desc: 'Despachos del día',                icon: BarChart3     },
  '/wms/inventory':           { title: 'Stock actual',           desc: 'Inventario disponible',            icon: Package       },
  '/wms/history':             { title: 'Historial de Despachos', desc: 'Trazabilidad completa',            icon: History       },
  '/wms/adjustment':          { title: 'Ajustes de Inventario',  desc: 'Correcciones de stock',            icon: TrendingDown  },
  '/wms/receipt':             { title: 'Recepción de Mercancía', desc: 'Entrada de inventario',            icon: PackagePlus   },
  '/wms/inventory-history':   { title: 'Movimientos',            desc: 'Entradas y salidas de inventario', icon: ArrowLeftRight },
  '/wms/import-csv':          { title: 'Importar CSV',           desc: 'Interrápidisimo y otras fuentes',  icon: Upload        },
  '/wms/manage-products':     { title: 'Gestión de Productos',   desc: 'Catálogo de referencias',          icon: Tag           },
  '/wms/manage-warehouses':   { title: 'Gestión de Bodegas',     desc: 'Administra tus almacenes',         icon: Warehouse     },
  '/wms/remote-scanner/host': { title: 'Remote Scanner',         desc: 'PC + móvil conectado',             icon: Monitor       },
  '/wms/scan-history':        { title: 'Historial de Escaneos',  desc: 'Escaneos por fecha',               icon: QrCode        },
  '/wms/batch-summary':       { title: 'Resumen de Batch',       desc: 'Revisión antes de confirmar',      icon: Layers        },
  '/wms/select-warehouse':    { title: 'Seleccionar Bodega',     desc: 'Elige el almacén activo',          icon: MapPin        },
  '/admin':                   { title: 'Administración',         desc: 'Panel de administración',          icon: Shield        },
  '/admin/bodegas':           { title: 'Mis Bodegas',            desc: 'Gestión de almacenes',             icon: Warehouse     },
  '/admin/operadores':        { title: 'Operadores',             desc: 'Usuarios del sistema',             icon: Users         },
  '/superadmin':              { title: 'Super Admin',            desc: 'Configuración global',             icon: Shield        },
  '/profile':                 { title: 'Mi Perfil',              desc: 'Datos de usuario',                 icon: User          },
  '/wms/production':          { title: 'Órdenes de Producción',  desc: 'Fabricación y manufactura',        icon: Factory       },
  '/wms/manage-categories':   { title: 'Categorías',             desc: 'Clasificación de productos',       icon: FolderOpen    },
  '/wms/returns':             { title: 'Devoluciones',           desc: 'Reposición de stock por retorno',  icon: RotateCcw     },
};

function resolveMeta(pathname) {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  const match = Object.keys(ROUTE_META)
    .filter(k => pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_META[match] : { title: 'WMS', desc: '', icon: BarChart3 };
}

export function TopBar() {
  const location          = useLocation();
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);
  const operator          = useStore((s) => s.operator);
  const { title, desc, icon: Icon } = resolveMeta(location.pathname);

  const initials = operator
    ? operator.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="hidden lg:flex fixed top-0 left-48 right-0 h-16 z-30 items-center justify-between px-6 bg-dark-900/80 backdrop-blur-xl border-b border-white/[0.06]">

      {/* ── Izquierda: icono + título/desc ── */}
      <div className="flex items-center gap-4">
        {/* Icono de sección */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.03] backdrop-blur-sm border border-white/[0.10] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary-400" />
        </div>

        {/* Título + descripción apilados */}
        <div>
          <p className="font-bold text-base leading-none bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">{title}</p>
          {desc && (
            <p className="text-white/40 text-sm font-medium mt-0.5 leading-none">{desc}</p>
          )}
        </div>
      </div>

      {/* ── Derecha: bodega + operador ─────────────────── */}
      <div className="flex items-center gap-2">
        {selectedWarehouse && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <div className="text-right">
              <p className="text-white/20 text-[9px] uppercase tracking-widest leading-none">Bodega</p>
              <p className="text-white/55 text-xs font-medium leading-none mt-0.5">{selectedWarehouse.name}</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
          </div>
        )}

        {/* Avatar operador */}
        <div className="w-8 h-8 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-primary-500/25 transition-all">
          <span className="text-primary-400 font-bold text-[11px]">{initials}</span>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
