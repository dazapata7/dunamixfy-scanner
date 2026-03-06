// =====================================================
// ADJUSTMENT FORM - Dunamix WMS
// =====================================================
// Formulario de ajuste de inventario
// Modos: Entrada (+), Ajuste (→ meta exacta), Salida (-)
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { productsService, inventoryService } from '../../services/wmsService';
import { ArrowLeft, FileEdit, Plus, Minus, Check, TrendingUp, TrendingDown, Target } from 'lucide-react';
import toast from 'react-hot-toast';

// Modos de ajuste
const MODES = [
  {
    key: 'increase',
    label: 'Entrada',
    icon: TrendingUp,
    color: 'green',
    description: 'Agregar stock',
    activeClass: 'bg-green-500/20 border-green-500 text-green-300',
    hoverClass: 'hover:border-green-500/50',
    buttonClass: 'bg-gradient-to-r from-green-500 to-emerald-500',
    preview: 'El stock se incrementará en la cantidad indicada',
  },
  {
    key: 'set',
    label: 'Ajuste',
    icon: Target,
    color: 'orange',
    description: 'Fijar cantidad exacta',
    activeClass: 'bg-orange-500/20 border-orange-500 text-orange-300',
    hoverClass: 'hover:border-orange-500/50',
    buttonClass: 'bg-gradient-to-r from-orange-500 to-amber-500',
    preview: 'El stock se llevará exactamente al valor indicado',
  },
  {
    key: 'decrease',
    label: 'Salida',
    icon: TrendingDown,
    color: 'red',
    description: 'Descontar stock',
    activeClass: 'bg-red-500/20 border-red-500 text-red-300',
    hoverClass: 'hover:border-red-500/50',
    buttonClass: 'bg-gradient-to-r from-red-500 to-rose-500',
    preview: 'El stock se reducirá en la cantidad indicada',
  },
];

export function AdjustmentForm() {
  const navigate = useNavigate();
  const { selectedWarehouse, operatorId } = useStore();

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [currentStock, setCurrentStock] = useState(null);
  const [mode, setMode] = useState('set'); // 'increase' | 'set' | 'decrease'
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Verificar almacén seleccionado
  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
    }
  }, [selectedWarehouse, navigate]);

  // Cargar productos
  useEffect(() => {
    loadProducts();
  }, []);

  // Cargar stock cuando se selecciona un producto
  useEffect(() => {
    if (selectedProduct && selectedWarehouse) {
      loadProductStock(selectedProduct);
    }
  }, [selectedProduct, selectedWarehouse]);

  async function loadProducts() {
    setIsLoadingProducts(true);
    try {
      const data = await productsService.getAll();
      setProducts(data);
    } catch (error) {
      console.error('❌ Error al cargar productos:', error);
      toast.error('Error al cargar productos');
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function loadProductStock(productId) {
    try {
      const stock = await inventoryService.getStock(selectedWarehouse.id, productId);
      setCurrentStock(stock.qty_on_hand || 0);
    } catch (error) {
      console.error('❌ Error al cargar stock:', error);
      setCurrentStock(0);
    }
  }

  // Calcular delta según el modo
  const parsedQty = parseInt(quantity) || 0;

  const delta = (() => {
    if (currentStock === null || parsedQty < 0) return null;
    if (mode === 'increase') return parsedQty;
    if (mode === 'decrease') return -parsedQty;
    if (mode === 'set') return parsedQty - currentStock; // ajuste exacto
    return null;
  })();

  const newStock = currentStock !== null && delta !== null ? currentStock + delta : null;

  const currentMode = MODES.find(m => m.key === mode);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      toast.error('Debe seleccionar un producto');
      return;
    }

    if (!parsedQty || parsedQty < 0) {
      toast.error('La cantidad debe ser un número válido mayor o igual a 0');
      return;
    }

    if (!reason || reason.trim() === '') {
      toast.error('Debe indicar la razón del ajuste');
      return;
    }

    // Validar según modo
    if (mode === 'decrease' && parsedQty > currentStock) {
      toast.error(`No puede descontar más de ${currentStock} unidades`);
      return;
    }

    if (mode === 'set' && parsedQty < 0) {
      toast.error('La cantidad objetivo no puede ser negativa');
      return;
    }

    // Si el ajuste no cambia nada, informar
    if (delta === 0) {
      toast('El inventario ya está en ese valor, no hay cambio que aplicar', { icon: 'ℹ️' });
      return;
    }

    setIsProcessing(true);

    try {
      const movementType = delta > 0 ? 'IN' : 'OUT';
      const qtySigned = delta; // ya tiene signo correcto

      const descriptionMap = {
        increase: `Entrada manual: +${parsedQty} unidades`,
        decrease: `Salida manual: -${parsedQty} unidades`,
        set: `Ajuste a ${parsedQty} unidades (${delta > 0 ? '+' : ''}${delta})`,
      };

      await inventoryService.createMovement({
        movement_type: movementType,
        qty_signed: qtySigned,
        warehouse_id: selectedWarehouse.id,
        product_id: selectedProduct,
        user_id: operatorId,
        ref_type: 'adjustment',
        ref_id: null,
        description: descriptionMap[mode],
        notes: reason
      });

      const modeLabels = { increase: 'Entrada registrada', decrease: 'Salida registrada', set: 'Inventario ajustado' };
      toast.success(`${modeLabels[mode]}. Nuevo stock: ${newStock}`);

      // Actualizar stock mostrado y limpiar campos para el siguiente ajuste
      setCurrentStock(newStock);
      setQuantity('');
      setReason('');

    } catch (error) {
      console.error('❌ Error al crear ajuste:', error);
      toast.error(error.message || 'Error al procesar el ajuste');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1100px] mx-auto">

        {/* Volver – solo móvil */}
        <button
          onClick={() => navigate('/wms')}
          className="lg:hidden mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <form onSubmit={handleSubmit}>
          {/* Layout desktop: dos columnas | móvil: columna única */}
          <div className="lg:grid lg:grid-cols-[1fr,380px] lg:gap-6 space-y-4 lg:space-y-0">

            {/* ── Columna izquierda ── */}
            <div className="space-y-4">

              {/* Mode Selector */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-3">
                <p className="text-white/40 text-xs uppercase tracking-wider px-1 mb-3">Tipo de movimiento</p>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map(({ key, label, icon: Icon, activeClass, hoverClass, description }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setMode(key); setQuantity(''); }}
                      className={`
                        p-4 rounded-xl border-2 transition-all text-center
                        ${mode === key ? activeClass : 'bg-white/5 border-white/10 text-white/60'}
                        ${hoverClass}
                      `}
                    >
                      <Icon className="w-5 h-5 mx-auto mb-1.5" />
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-[11px] mt-0.5 opacity-70 hidden sm:block">{description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Selection */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
                <label className="block text-white/70 text-xs uppercase tracking-wider mb-3">Producto</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  style={{ colorScheme: 'dark' }}
                  required
                >
                  <option value="" style={{ backgroundColor: '#1a1a1a', color: '#999' }}>Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>

                {currentStock !== null && (
                  <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-white/50 text-sm">Stock actual en bodega</p>
                    <p className="text-white text-2xl font-bold tabular-nums">{currentStock}</p>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
                <label className="block text-white/70 text-xs uppercase tracking-wider mb-3">
                  {mode === 'set' ? 'Stock final deseado' : 'Cantidad'}
                </label>
                <input
                  type="number"
                  min={mode === 'set' ? '0' : '1'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={mode === 'set' ? 'Ej: 385' : 'Ej: 50'}
                  className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-500/50 placeholder-white/20"
                  required
                />
              </div>
            </div>

            {/* ── Columna derecha ── */}
            <div className="space-y-4">

              {/* Vista previa del cambio */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Vista previa</p>
                {newStock !== null && currentStock !== null && parsedQty > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-center flex-1">
                        <p className="text-white/40 text-xs mb-1">Actual</p>
                        <p className="text-white text-3xl font-bold tabular-nums">{currentStock}</p>
                      </div>
                      <div className="text-center px-4">
                        <p className={`text-xl font-bold tabular-nums ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-white/30'}`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </p>
                        <p className="text-white/20 text-[10px] mt-1">
                          {mode === 'set' ? 'ajuste' : mode === 'increase' ? 'entrada' : 'salida'}
                        </p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-white/40 text-xs mb-1">Nuevo</p>
                        <p className={`text-3xl font-bold tabular-nums ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-white/30'}`}>
                          {newStock}
                        </p>
                      </div>
                    </div>
                    {delta === 0 && (
                      <p className="text-center text-white/40 text-xs">El stock ya está en ese valor</p>
                    )}
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-white/20 text-sm">Selecciona producto y cantidad para ver la vista previa</p>
                  </div>
                )}
              </div>

              {/* Razón */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
                <label className="block text-white/70 text-xs uppercase tracking-wider mb-3">
                  Razón <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Conteo físico, Producto dañado, Corrección de inventario..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none text-sm"
                  required
                />
                <p className="text-white/30 text-xs mt-2">Quedará registrado para auditoría</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isProcessing || !selectedProduct || isLoadingProducts}
                className={`
                  w-full px-6 py-4 rounded-xl font-medium
                  flex items-center justify-center gap-2 transition-all
                  ${currentMode?.buttonClass ?? 'bg-orange-500'}
                  text-white hover:shadow-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {mode === 'increase' ? 'Registrar Entrada' : mode === 'decrease' ? 'Registrar Salida' : 'Aplicar Ajuste'}
                  </>
                )}
              </button>

              <p className="text-center text-white/30 text-xs">{currentMode?.preview}</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdjustmentForm;
