// =====================================================
// INVENTORY LIST - Dunamix WMS
// =====================================================
// Visualización de stock actual por almacén
// Búsqueda, filtros, indicadores visuales
// =====================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../hooks/useInventory';
import { useStore } from '../../store/useStore';
import { ArrowLeft, Search, Package, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';

export function InventoryList() {
  const navigate = useNavigate();
  const { selectedWarehouse } = useStore();
  const { stock, isLoading, search, reload } = useInventory(selectedWarehouse?.id);

  const [searchInput, setSearchInput] = useState('');

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

  // Función para determinar el color según el stock
  const getStockColor = (qty) => {
    if (qty === 0) return 'text-red-400';
    if (qty < 10) return 'text-orange-400';
    if (qty < 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStockBadge = (qty) => {
    if (qty === 0) return { text: 'Sin stock', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
    if (qty < 10) return { text: 'Bajo', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
    if (qty < 50) return { text: 'Medio', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
    return { text: 'Disponible', color: 'bg-green-500/20 text-green-300 border-green-500/30' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/wms')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <button
            onClick={handleReload}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Title Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 rounded-2xl bg-white/10">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Inventario
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {selectedWarehouse.name}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por SKU o nombre..."
              value={searchInput}
              onChange={handleSearch}
              className="
                w-full pl-12 pr-4 py-3
                rounded-xl
                bg-white/5 backdrop-blur-xl
                border border-white/10
                text-white placeholder-white/40
                focus:outline-none focus:ring-2 focus:ring-primary-500/50
                transition-all
              "
            />
          </div>

          {/* Summary */}
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-white/60">
              <Package className="w-4 h-4" />
              <span>{stock.length} productos</span>
            </div>
            {stock.filter(s => s.qty_on_hand === 0).length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>{stock.filter(s => s.qty_on_hand === 0).length} sin stock</span>
              </div>
            )}
          </div>
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

        {/* Stock List */}
        {!isLoading && stock.length > 0 && (
          <div className="space-y-3">
            {stock.map((item, index) => {
              const badge = getStockBadge(item.qty_on_hand);

              return (
                <div
                  key={index}
                  className="
                    bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10
                    p-5 shadow-glass-lg
                    hover:bg-white/10 hover:border-white/20
                    transition-all
                  "
                >
                  <div className="flex items-start gap-4">
                    {/* Product Photo */}
                    <div className="flex-shrink-0">
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={item.product_name}
                          className="w-20 h-20 rounded-xl object-cover border border-white/10"
                          onError={(e) => {
                            // Si falla la carga de imagen, mostrar placeholder
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-20 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${item.photo_url ? 'hidden' : 'flex'}`}
                        style={{ display: item.photo_url ? 'none' : 'flex' }}
                      >
                        <Package className="w-8 h-8 text-white/30" />
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-white/80 text-sm bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                          {item.sku}
                        </span>
                        <span className={`
                          text-xs px-2 py-1 rounded-lg border
                          ${badge.color}
                        `}>
                          {badge.text}
                        </span>
                      </div>

                      <h3 className="text-white font-medium mb-1 truncate">
                        {item.product_name}
                      </h3>

                      {item.barcode && (
                        <p className="text-white/40 text-xs font-mono truncate">
                          Barcode: {item.barcode}
                        </p>
                      )}
                    </div>

                    {/* Stock Quantity */}
                    <div className="text-right flex-shrink-0">
                      <div className={`
                        text-3xl font-bold
                        ${getStockColor(item.qty_on_hand)}
                      `}>
                        {item.qty_on_hand}
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        unidades
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && stock.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 mb-4">
              <Package className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-white font-medium mb-2">
              {searchInput ? 'No se encontraron productos' : 'Inventario vacío'}
            </h3>
            <p className="text-white/60 text-sm mb-6">
              {searchInput
                ? `No hay productos que coincidan con "${searchInput}"`
                : 'Aún no hay productos en el inventario de este almacén'
              }
            </p>
            {searchInput && (
              <button
                onClick={handleReload}
                className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all"
              >
                Ver todos los productos
              </button>
            )}
          </div>
        )}

        {/* Info Footer */}
        {!isLoading && stock.length > 0 && (
          <div className="mt-6 text-center text-white/40 text-sm">
            <p>Stock calculado en tiempo real desde movimientos de inventario</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryList;
