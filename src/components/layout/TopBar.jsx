// =====================================================
// TOP BAR - Dunamix WMS (Desktop/Tablet)
// =====================================================
// Barra superior fija que muestra la sección actual
// Complementa el SidebarLayout (solo visible lg+)
// =====================================================

import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';

const ROUTE_META = {
  '/wms/dashboard':              { title: 'Dashboard',                  desc: 'Despachos del día' },
  '/wms/inventory':              { title: 'Stock actual',               desc: 'Inventario disponible' },
  '/wms/history':                { title: 'Historial de Despachos',     desc: 'Trazabilidad completa' },
  '/wms/adjustment':             { title: 'Ajustes de Inventario',      desc: 'Correcciones de stock' },
  '/wms/receipt':                { title: 'Recepción de Mercancía',     desc: 'Entrada de inventario' },
  '/wms/inventory-history':      { title: 'Movimientos',                desc: 'Entradas y salidas de inventario' },
  '/wms/import-csv':             { title: 'Importar CSV',               desc: 'Interrápidisimo y otras fuentes' },
  '/wms/manage-products':        { title: 'Productos',                  desc: 'Catálogo de referencias' },
  '/wms/manage-warehouses':      { title: 'Bodegas',                    desc: 'Gestión de almacenes' },
  '/wms/remote-scanner/host':    { title: 'Remote Scanner',             desc: 'PC + móvil conectado' },
  '/wms/scan-history':           { title: 'Historial de Escaneos',      desc: 'Escaneos por fecha' },
  '/wms/batch-summary':          { title: 'Resumen de Batch',           desc: 'Revisión antes de confirmar' },
  '/wms/select-warehouse':       { title: 'Seleccionar Bodega',         desc: 'Elige el almacén activo' },
  '/admin':                      { title: 'Administración',             desc: 'Panel de administración' },
  '/admin/bodegas':              { title: 'Mis Bodegas',                desc: 'Gestión de almacenes' },
  '/admin/operadores':           { title: 'Operadores',                 desc: 'Usuarios del sistema' },
  '/superadmin':                 { title: 'Super Admin',                desc: 'Configuración global de la plataforma' },
  '/profile':                    { title: 'Mi Perfil',                  desc: 'Datos de usuario' },
  '/register-company':           { title: 'Registro de Empresa',        desc: 'Configura tu warehouse' },
};

function resolveMeta(pathname) {
  // Exact match first
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  // Prefix match (e.g. /wms/remote-scanner/client/abc)
  const match = Object.keys(ROUTE_META)
    .filter(k => pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_META[match] : { title: 'WMS', desc: '' };
}

export function TopBar() {
  const location = useLocation();
  const selectedWarehouse = useStore((s) => s.selectedWarehouse);
  const { title, desc } = resolveMeta(location.pathname);

  return (
    <header className="hidden lg:flex fixed top-0 left-60 right-0 h-14 z-30 items-center justify-between px-6 bg-dark-950/90 backdrop-blur-xl border-b border-white/8">
      {/* Título de la sección */}
      <div className="flex items-center gap-3">
        <h1 className="text-white font-semibold text-base leading-none">{title}</h1>
        {desc && (
          <>
            <span className="text-white/20 text-sm">/</span>
            <span className="text-white/40 text-sm">{desc}</span>
          </>
        )}
      </div>

      {/* Bodega activa */}
      {selectedWarehouse && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/60 text-xs font-medium">{selectedWarehouse.name}</span>
        </div>
      )}
    </header>
  );
}

export default TopBar;
