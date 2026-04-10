// =====================================================
// INVENTORY LIST - Dunamix WMS
// =====================================================
// Visualización de stock estilo dashboard con grid de productos
// Stats superiores + búsqueda/filtros + productos agrupados
// =====================================================

import { useState, memo } from 'react';
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

// ── Estado de stock ───────────────────────────────
function getStockStatus(qty, isCombo = false, estimated = 0) {
  const q = isCombo ? estimated : qty;
  if (isCombo) {
    if (q === 0) return { label: 'Sin capacidad', color: 'bg-red-500/10 text-red-400/80 border-red-500/20' };
    if (q < 5)  return { label: 'Capacidad baja', color: 'bg-orange-500/10 text-orange-400/80 border-orange-500/20' };
    return { label: 'Armable', color: 'bg-primary-500/10 text-primary-400/80 border-primary-500/20' };
  }
  if (q === 0)  return { label: 'Sin stock',   color: 'bg-red-500/10 text-red-400/80 border-red-500/20' };
  if (q < 10)   return { label: 'Stock bajo',  color: 'bg-orange-500/10 text-orange-400/80 border-orange-500/20' };
  return { label: 'Disponible', color: 'bg-primary-500/10 text-primary-400/80 border-primary-500/20' };
}

// ── Fila de producto ──────────────────────────────
const ProductRow = memo(function ProductRow({ item }) {
  const isCombo = item.type === 'combo' || item.is_combo;
  const estimated = item.estimated_capacity ?? 0;
  const status = getStockStatus(item.qty_on_hand, isCombo, estimated);
  const displayQty = isCombo ? estimated : item.qty_on_hand;
  const qtyColor = displayQty === 0 ? 'text-red-400' : displayQty < (isCombo ? 5 : 10) ? 'text-orange-400' : 'text-white';

  return (
    <div className={`backdrop-blur-md rounded-2xl border px-4 py-3 flex items-center gap-4 hover:bg-white/[0.08] transition-all ${
      isCombo
        ? 'bg-white/[0.04] border-purple-500/20 hover:border-purple-500/30'
        : 'bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15]'
    }`}>
      {item.photo_url ? (
        <img src={item.photo_url} alt={item.product_name}
          className="w-10 h-10 object-cover rounded-lg border border-white/[0.08] shrink-0"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div className={`w-10 h-10 rounded-lg border items-center justify-center shrink-0 ${item.photo_url ? 'hidden' : 'flex'} ${isCombo ? 'bg-purple-500/10 border-purple-500/20' : 'bg-white/[0.04] border-white/[0.08]'}`}
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
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${status.color}`}>{status.label}</span>
      </div>
    </div>
  );
});

// ── Sección agrupada ──────────────────────────────
const ProductSection = memo(function ProductSection({ title, items, color, icon: Icon }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-3 mb-3 pb-2 border-b ${color.border}`}>
        <div className={`p-1.5 rounded-lg ${color.bg}`}>
          <Icon className={`w-4 h-4 ${color.icon}`} />
        </div>
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color.badge}`}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => <ProductRow key={item.id || i} item={item} />)}
      </div>
    </div>
  );
});

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

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* Header – solo móvil */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-lg">Gestión de Inventarios</h1>
              <p className="text-white/40 text-sm mt-0.5">Administra productos, stock y bodegas</p>
            </div>
            <button onClick={() => navigate('/wms')}
              className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* Total Referencias */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Package className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Referencias</span>
            </div>
            <p className="text-3xl font-bold text-white">{stock.length}</p>
            <p className="text-xs text-white/40 mt-1">{regularStock.length} prod · {comboStock.length} combos</p>
          </div>

          {/* Almacén */}
          <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 rounded-2xl border border-primary-500/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary-500/20">
                <Warehouse className="w-5 h-5 text-primary-400" />
              </div>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Almacén</span>
            </div>
            <p className="text-3xl font-bold text-white">1</p>
            <p className="text-xs text-white/40 mt-1">{selectedWarehouse.name}</p>
          </div>

          {/* Unidades en Stock */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">En Stock</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalUnits.toLocaleString()}</p>
            <p className="text-xs text-white/40 mt-1">Unidades de productos</p>
          </div>

          {/* Stock Bajo */}
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 backdrop-blur-xl rounded-2xl border border-orange-500/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Stock Bajo</span>
            </div>
            <p className="text-3xl font-bold text-white">{lowStock}</p>
            <p className="text-xs text-white/40 mt-1">Menos de 10 unidades</p>
          </div>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
            <input type="text" placeholder="Buscar por nombre, SKU o categoría..."
              value={searchInput} onChange={handleSearch}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full pl-10"
            />
          </div>

          <button onClick={() => setHideOutOfStock(!hideOutOfStock)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm ${
              hideOutOfStock
                ? 'bg-primary-500/10 border-primary-500/20 text-primary-400'
                : 'bg-white/[0.05] border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white'
            }`}>
            {hideOutOfStock ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{hideOutOfStock ? 'Mostrar todos' : 'Ocultar sin stock'}</span>
          </button>

          <button onClick={handleReload} disabled={isLoading}
            className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button onClick={handleExportCSV} disabled={isLoading || stock.length === 0}
            className="bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center gap-2 text-sm disabled:opacity-50">
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Lista agrupada */}
        {!isLoading && (filteredRegular.length > 0 || filteredCombos.length > 0) && (
          <>
            <ProductSection title="Productos" items={filteredRegular} icon={Package}
              color={{
                border: 'border-white/[0.08]',
                bg: 'bg-cyan-500/15',
                icon: 'text-cyan-400',
                badge: 'bg-cyan-500/10 text-cyan-400/80 border-cyan-500/20'
              }}
            />
            <ProductSection title="Productos Combos" items={filteredCombos} icon={Layers}
              color={{
                border: 'border-purple-500/20',
                bg: 'bg-purple-500/15',
                icon: 'text-purple-400',
                badge: 'bg-purple-500/10 text-purple-400/80 border-purple-500/20'
              }}
            />
          </>
        )}

        {/* Empty State */}
        {!isLoading && filteredRegular.length === 0 && filteredCombos.length === 0 && (
          <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08]">
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">
                {searchInput ? `No hay productos que coincidan con "${searchInput}"`
                  : hideOutOfStock ? 'No hay productos con stock'
                  : 'Inventario vacío'}
              </p>
              {(searchInput || hideOutOfStock) && (
                <button onClick={() => { setSearchInput(''); setHideOutOfStock(false); reload(); }}
                  className="mt-3 bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all text-sm">
                  Ver todos los productos
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryList;
