// =====================================================
// TOP BAR - Dunamixfy WMS (Desktop/Tablet)
// =====================================================
// Estilo Dunamixfy: logo + icono de sección + título/desc apilados
// =====================================================

import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  BarChart3, Monitor, History, ArrowLeftRight,
  Package, PackagePlus, TrendingDown,
  Upload, Tag, Warehouse,
  Users, Shield, User, MapPin, QrCode, Layers
} from 'lucide-react';

const ROUTE_META = {
  '/wms/dashboard':           { title: 'Dashboard',             desc: 'Despachos del día',                icon: BarChart3    },
  '/wms/inventory':           { title: 'Stock actual',          desc: 'Inventario disponible',            icon: Package      },
  '/wms/history':             { title: 'Historial de Despachos',desc: 'Trazabilidad completa',            icon: History      },
  '/wms/adjustment':          { title: 'Ajustes de Inventario', desc: 'Correcciones de stock',            icon: TrendingDown },
  '/wms/receipt':             { title: 'Recepción de Mercancía',desc: 'Entrada de inventario',            icon: PackagePlus  },
  '/wms/inventory-history':   { title: 'Movimientos',           desc: 'Entradas y salidas de inventario', icon: ArrowLeftRight},
  '/wms/import-csv':          { title: 'Importar CSV',          desc: 'Interrápidisimo y otras fuentes',  icon: Upload       },
  '/wms/manage-products':     { title: 'Productos',             desc: 'Catálogo de referencias',          icon: Tag          },
  '/wms/manage-warehouses':   { title: 'Bodegas',               desc: 'Gestión de almacenes',             icon: Warehouse    },
  '/wms/remote-scanner/host': { title: 'Remote Scanner',        desc: 'PC + móvil conectado',             icon: Monitor      },
  '/wms/scan-history':        { title: 'Historial de Escaneos', desc: 'Escaneos por fecha',               icon: QrCode       },
  '/wms/batch-summary':       { title: 'Resumen de Batch',      desc: 'Revisión antes de confirmar',      icon: Layers       },
  '/wms/select-warehouse':    { title: 'Seleccionar Bodega',    desc: 'Elige el almacén activo',          icon: MapPin       },
  '/admin':                   { title: 'Administración',        desc: 'Panel de administración',          icon: Shield       },
  '/admin/bodegas':           { title: 'Mis Bodegas',           desc: 'Gestión de almacenes',             icon: Warehouse    },
  '/admin/operadores':        { title: 'Operadores',            desc: 'Usuarios del sistema',             icon: Users        },
  '/superadmin':              { title: 'Super Admin',           desc: 'Configuración global',             icon: Shield       },
  '/profile':                 { title: 'Mi Perfil',             desc: 'Datos de usuario',                 icon: User         },
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

  return (
    <header className="hidden lg:flex fixed top-0 left-60 right-0 h-14 z-30 items-center justify-between px-5 bg-dark-950 border-b border-white/[0.06]">

      {/* ── Izquierda: icono de sección + título/desc ── */}
      <div className="flex items-center gap-3">
        {/* Icono en cuadro — igual que Dunamixfy */}
        <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary-400" />
        </div>
        {/* Título + descripción apilados */}
        <div>
          <p className="text-white font-bold text-sm leading-none">{title}</p>
          {desc && (
            <p className="text-white/30 text-xs mt-0.5 leading-none">{desc}</p>
          )}
        </div>
      </div>

      {/* ── Derecha: bodega + operador ────────────────── */}
      <div className="flex items-center gap-2">
        {selectedWarehouse && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
            <div className="text-right">
              <p className="text-white/25 text-[9px] uppercase tracking-widest leading-none">Bodega</p>
              <p className="text-white/60 text-xs font-medium leading-none mt-0.5">{selectedWarehouse.name}</p>
            </div>
          </div>
        )}
        {operator && (
          <div className="w-7 h-7 rounded-full bg-primary-500/20 border border-primary-500/25 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-400 font-bold text-[10px]">
              {operator.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopBar;
