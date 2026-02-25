// =====================================================
// INVENTORY LIST - Dunamix WMS
// =====================================================
// Visualización de stock estilo dashboard con grid de productos
// Stats superiores + búsqueda/filtros + productos agrupados
// =====================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../hooks/useInventory';
import { useStore } from '../../store/useStore';
import {
  ArrowLeft,
  Search,
  Package,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Warehouse,
  Download,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── CSV helper ────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows.length) { toast.error('No hay datos para exportar'); return; }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function InventoryList() {
  const navigate = useNavigate();
  const { selectedWarehouse } = useStore();
  const { stock, isLoading, search, reload } = useInventory(selectedWarehouse?.id);

  const [searchInput, setSearchInput] = useState('');
  const [hideOutOfStock, setHideOutOfStock] = useState(false);

  if (!selectedWarehouse) {
    navigate('/wms/select-warehouse');
    return null;
  }

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    search(value);
  };

  const handleReload = () => {
    setSearchInput('');
    reload();
  };

  // ── Stats ─────────────────────────────────────────
  const regularStock = stock.filter(s => s.type !== 'combo' && !s.is_combo);
  const comboStock   = stock.filter(s => s.type === 'combo'  || s.is_combo);

  const effectiveQty  = (s) => s.type === 'combo' ? (s.estimated_capacity ?? 0) : s.qty_on_hand;
  const lowStock      = stock.filter(s => { const q = effectiveQty(s); return q > 0 && q < 10; }).length;
  const totalUnits    = regularStock.reduce((sum, s) => sum + s.qty_on_hand, 0);

  // ── Filtrar ───────────────────────────────────────
  const filtered = (list) => hideOutOfStock
    ? list.filter(s => effectiveQty(s) > 0)
    : list;

  const filteredRegular = filtered(regularStock);
  const filteredCombos  = filtered(comboStock);

  // ── Estado de stock ───────────────────────────────
  const getStockStatus = (qty, isCombo = false, estimated = 0) => {
    const q = isCombo ? estimated : qty;
    if (isCombo) {
      if (q === 0) return { label: 'Sin capacidad', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      if (q < 5)  return { label: 'Capacidad baja', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      return { label: 'Armable', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    }
    if (q === 0)  return { label: 'Sin stock',   color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (q < 10)   return { label: 'Stock bajo',  color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    return { label: 'Disponible', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
  };

  // ── CSV export ────────────────────────────────────
  const handleExportCSV = () => {
    const all = [...filteredRegular, ...filteredCombos];
    const rows = all.map(item => {
      const isCombo = item.type === 'combo' || item.is_combo;
      const qty = isCombo ? (item.estimated_capacity ?? 0) : item.qty_on_hand;
      const status = getStockStatus(item.qty_on_hand, isCombo, item.estimated_capacity ?? 0);
      return {
        Nombre:   item.product_name,
        SKU:      item.sku,
        Tipo:     isCombo ? 'Combo' : 'Producto',
        Unidades: qty,
        Estado:   status.label,
        Bodega:   selectedWarehouse.name,
      };
    });
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(rows, `inventario_${selectedWarehouse.code || 'bodega'}_${date}.csv`);
    toast.success(`${rows.length} referencias exportadas`);
  };

  // ── Fila de producto ──────────────────────────────
  const ProductRow = ({ item }) => {
    const isCombo = item.type === 'combo' || item.is_combo;
    const estimated = item.estimated_capacity ?? 0;
    const status = getStockStatus(item.qty_on_hand, isCombo, estimated);
    const displayQty = isCombo ? estimated : item.qty_on_hand;
    const qtyColor = displayQty === 0 ? 'text-red-400' : displayQty < (isCombo ? 5 : 10) ? 'text-orange-400' : 'text-white';

    return (
      <div className={`backdrop-blur-xl rounded-xl border px-4 py-3 flex items-center gap-4 hover:bg-white/10 transition-all ${
        isCombo ? 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}>
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.product_name}
            className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div className={`w-10 h-10 rounded-lg border items-center justify-center shrink-0 ${item.photo_url ? 'hidden' : 'flex'} ${isCombo ? 'bg-purple-500/10 border-purple-500/20' : 'bg-white/5 border-white/10'}`}
          style={{ display: item.photo_url ? 'none' : 'flex' }}>
          <Package className={`w-5 h-5 ${isCombo ? 'text-purple-400/50' : 'text-white/30'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate" title={item.product_name}>{item.product_name}</p>
          <p className="text-white/40 text-xs font-mono mt-0.5">{item.sku}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-2xl font-bold ${qtyColor}`}>{displayQty}</span>
          <p className="text-white/40 text-[10px]">{isCombo ? 'estimados' : 'unidades'}</p>
        </div>
        <div className="shrink-0 w-32 flex justify-center">
          <span className={`text-xs px-3 py-1 rounded-lg border font-medium ${status.color}`}>{status.label}</span>
        </div>
      </div>
    );
  };

  // ── Sección agrupada ──────────────────────────────
  const ProductSection = ({ title, items, color, icon: Icon }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <div className={`flex items-center gap-3 mb-3 pb-2 border-b ${color.border}`}>
          <div className={`p-1.5 rounded-lg ${color.bg}`}>
            <Icon className={`w-4 h-4 ${color.icon}`} />
          </div>
          <h2 className="text-white/80 font-semibold text-sm">{title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${color.badge}`}>{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => <ProductRow key={item.id || i} item={item} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-[1600px] mx-auto">

        {/* Header – solo móvil (desktop usa TopBar) */}
        <div className="mb-6 lg:hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gestión de Inventarios</h1>
              <p className="text-white/60">Administra productos, stock y bodegas en un solo lugar</p>
            </div>
            <button onClick={() => navigate('/wms')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

          {/* Total Referencias */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Package className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">TOTAL REFERENCIAS</p>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{stock.length}</p>
            <div className="space-y-0.5">
              <p className="text-cyan-400/80 text-xs">↳ {regularStock.length} productos</p>
              <p className="text-purple-400/80 text-xs">↳ {comboStock.length} combos</p>
            </div>
          </div>

          {/* Almacén */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Warehouse className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">ALMACENES</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">1</p>
            <p className="text-blue-400 text-xs">{selectedWarehouse.name}</p>
          </div>

          {/* Unidades en Stock */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">UNIDADES EN STOCK</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{totalUnits.toLocaleString()}</p>
            <p className="text-purple-400 text-xs">Unidades de productos</p>
          </div>

          {/* Stock Bajo */}
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 backdrop-blur-xl rounded-2xl border border-orange-500/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">STOCK BAJO</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{lowStock}</p>
            <p className="text-orange-400 text-xs">Menos de 10 unidades</p>
          </div>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input type="text" placeholder="Buscar por nombre, SKU o categoría..."
              value={searchInput} onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>

          <button onClick={() => setHideOutOfStock(!hideOutOfStock)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              hideOutOfStock ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}>
            {hideOutOfStock ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm">{hideOutOfStock ? 'Mostrar todos' : 'Ocultar sin stock'}</span>
          </button>

          <button onClick={handleReload} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Actualizar</span>
          </button>

          <button onClick={handleExportCSV} disabled={isLoading || stock.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
            <Download className="w-4 h-4" />
            <span className="text-sm">Exportar CSV</span>
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-white/60">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p>Cargando inventario...</p>
            </div>
          </div>
        )}

        {/* Lista agrupada */}
        {!isLoading && (filteredRegular.length > 0 || filteredCombos.length > 0) && (
          <>
            <ProductSection title="Productos" items={filteredRegular} icon={Package}
              color={{ border: 'border-white/10', bg: 'bg-cyan-500/15', icon: 'text-cyan-400', badge: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' }}
            />
            <ProductSection title="Productos Combos" items={filteredCombos} icon={Layers}
              color={{ border: 'border-purple-500/20', bg: 'bg-purple-500/15', icon: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/20' }}
            />
          </>
        )}

        {/* Empty State */}
        {!isLoading && filteredRegular.length === 0 && filteredCombos.length === 0 && (
          <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 mb-4">
              <Package className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-white font-medium mb-2">
              {searchInput ? 'No se encontraron productos' : hideOutOfStock ? 'No hay productos con stock' : 'Inventario vacío'}
            </h3>
            <p className="text-white/60 text-sm mb-6">
              {searchInput ? `No hay productos que coincidan con "${searchInput}"`
                : hideOutOfStock ? 'Todos los productos están sin stock.'
                : 'Aún no hay productos en el inventario de este almacén'}
            </p>
            {(searchInput || hideOutOfStock) && (
              <button onClick={() => { setSearchInput(''); setHideOutOfStock(false); reload(); }}
                className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all">
                Ver todos los productos
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryList;
