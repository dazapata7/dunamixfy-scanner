// =====================================================
// INVENTORY LIST - Dunamix WMS
// =====================================================
// Visualización de stock estilo dashboard con grid de productos
// Stats superiores + búsqueda/filtros + tarjetas de productos
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
  Filter,
  Eye,
  EyeOff,
  Warehouse,
  DollarSign
} from 'lucide-react';

export function InventoryList() {
  const navigate = useNavigate();
  const { selectedWarehouse } = useStore();
  const { stock, isLoading, search, reload } = useInventory(selectedWarehouse?.id);

  const [searchInput, setSearchInput] = useState('');
  const [hideOutOfStock, setHideOutOfStock] = useState(false);

  // Verificar almacén seleccionado
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

  // Calcular estadísticas
  const totalProducts = stock.length;
  // Para combos usar capacidad estimada; para simples usar qty_on_hand
  const effectiveQty = (s) => s.type === 'combo' ? (s.estimated_capacity ?? 0) : s.qty_on_hand;
  const outOfStock = stock.filter(s => effectiveQty(s) === 0).length;
  const lowStock = stock.filter(s => effectiveQty(s) > 0 && effectiveQty(s) < 10).length;
  const totalUnits = stock.filter(s => s.type !== 'combo').reduce((sum, s) => sum + s.qty_on_hand, 0);

  // Filtrar productos
  const filteredStock = hideOutOfStock
    ? stock.filter(s => s.qty_on_hand > 0)
    : stock;

  // Función para determinar el estado del stock
  const getStockStatus = (qty, isCombo = false, estimatedCapacity = 0) => {
    // Para combos, usar capacidad estimada en lugar de qty_on_hand (que siempre es 0)
    const effectiveQty = isCombo ? estimatedCapacity : qty;

    if (isCombo) {
      if (effectiveQty === 0) return {
        label: 'Sin capacidad',
        color: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: '🔴'
      };
      if (effectiveQty < 5) return {
        label: 'Capacidad baja',
        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        icon: '🟠'
      };
      return {
        label: 'Armable',
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: '🟢'
      };
    }

    if (effectiveQty === 0) return {
      label: 'Sin stock',
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: '🔴'
    };
    if (effectiveQty < 10) return {
      label: 'Stock bajo',
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      icon: '🟠'
    };
    return {
      label: 'Disponible',
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: '🟢'
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-[1600px] mx-auto">

        {/* Header con título */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gestión de Inventarios</h1>
              <p className="text-white/60">Administra productos, stock y bodegas en un solo lugar</p>
            </div>
            <button
              onClick={() => navigate('/wms')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Productos */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Package className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">PRODUCTOS</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{totalProducts}</p>
            <p className="text-cyan-400 text-xs">Total de referencias</p>
            {outOfStock > 0 && (
              <p className="text-orange-400 text-xs mt-1">⚠️ {outOfStock} con stock crítico</p>
            )}
          </div>

          {/* Almacenes */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Warehouse className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">ALMACENES</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">1</p>
            <p className="text-blue-400 text-xs">{selectedWarehouse.name}</p>
          </div>

          {/* Unidades Totales */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-6">
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
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 backdrop-blur-xl rounded-2xl border border-orange-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-white/60 text-sm font-medium">STOCK BAJO</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{lowStock}</p>
            <p className="text-orange-400 text-xs">Productos con menos de 10 unidades</p>
          </div>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 flex items-center gap-4 flex-wrap">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o categoría..."
              value={searchInput}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>

          {/* Toggle Ocultar Sin Stock */}
          <button
            onClick={() => setHideOutOfStock(!hideOutOfStock)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              hideOutOfStock
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            {hideOutOfStock ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm">{hideOutOfStock ? 'Mostrar todos' : 'Ocultar sin stock'}</span>
          </button>

          {/* Botón Actualizar */}
          <button
            onClick={handleReload}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Actualizar</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-white/60">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p>Cargando inventario...</p>
            </div>
          </div>
        )}

        {/* Lista de Productos */}
        {!isLoading && filteredStock.length > 0 && (
          <div className="space-y-2">
            {filteredStock.map((item, index) => {
              const isCombo = item.type === 'combo' || item.is_combo;
              const estimatedCapacity = item.estimated_capacity ?? 0;
              const status = getStockStatus(item.qty_on_hand, isCombo, estimatedCapacity);
              const displayQty = isCombo ? estimatedCapacity : item.qty_on_hand;
              const qtyColor = displayQty === 0 ? 'text-red-400' : displayQty < (isCombo ? 5 : 10) ? 'text-orange-400' : 'text-white';

              return (
                <div
                  key={index}
                  className={`backdrop-blur-xl rounded-xl border px-4 py-3 flex items-center gap-4 hover:bg-white/10 transition-all ${
                    isCombo
                      ? 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Foto */}
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.product_name}
                      className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-10 h-10 rounded-lg border items-center justify-center shrink-0 ${item.photo_url ? 'hidden' : 'flex'} ${isCombo ? 'bg-purple-500/10 border-purple-500/20' : 'bg-white/5 border-white/10'}`}
                    style={{ display: item.photo_url ? 'none' : 'flex' }}
                  >
                    <Package className={`w-5 h-5 ${isCombo ? 'text-purple-400/50' : 'text-white/30'}`} />
                  </div>

                  {/* Nombre + badge combo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm truncate" title={item.product_name}>
                        {item.product_name}
                      </p>
                      {isCombo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                          COMBO
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs font-mono mt-0.5">{item.sku}</p>
                  </div>

                  {/* Stock / Capacidad estimada */}
                  <div className="text-right shrink-0">
                    <span className={`text-2xl font-bold ${qtyColor}`}>
                      {displayQty}
                    </span>
                    <p className="text-white/40 text-[10px]">
                      {isCombo ? 'estimados' : 'unidades'}
                    </p>
                  </div>

                  {/* Estado */}
                  <div className="shrink-0 w-32 flex justify-center">
                    <span className={`text-xs px-3 py-1 rounded-lg border font-medium ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredStock.length === 0 && (
          <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 mb-4">
              <Package className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-white font-medium mb-2">
              {searchInput ? 'No se encontraron productos' : hideOutOfStock ? 'No hay productos con stock' : 'Inventario vacío'}
            </h3>
            <p className="text-white/60 text-sm mb-6">
              {searchInput
                ? `No hay productos que coincidan con "${searchInput}"`
                : hideOutOfStock
                  ? 'Todos los productos están sin stock. Desactiva el filtro para verlos.'
                  : 'Aún no hay productos en el inventario de este almacén'
              }
            </p>
            {(searchInput || hideOutOfStock) && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setHideOutOfStock(false);
                  reload();
                }}
                className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all"
              >
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
