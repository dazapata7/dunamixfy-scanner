// =====================================================
// ADJUSTMENT FORM - Dunamix WMS
// =====================================================
// Formulario de ajuste de inventario
// Para correcciones de stock (+ o -)
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { productsService, inventoryService } from '../../services/wmsService';
import { ArrowLeft, FileEdit, Plus, Minus, Check, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdjustmentForm() {
  const navigate = useNavigate();
  const { selectedWarehouse, operatorId } = useStore();

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [currentStock, setCurrentStock] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('increase'); // 'increase' | 'decrease'
  const [quantity, setQuantity] = useState(1);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!selectedProduct) {
      toast.error('Debe seleccionar un producto');
      return;
    }

    if (!quantity || quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (!reason || reason.trim() === '') {
      toast.error('Debe indicar la razón del ajuste');
      return;
    }

    // Validar que no deje stock negativo en caso de decrease
    if (adjustmentType === 'decrease' && quantity > currentStock) {
      toast.error(`No puede descontar más de ${currentStock} unidades`);
      return;
    }

    setIsProcessing(true);

    try {
      // Crear movimiento de ajuste
      // IN = entrada (qty positivo), OUT = salida (qty negativo)
      const movementType = adjustmentType === 'increase' ? 'IN' : 'OUT';
      const qtySigned = adjustmentType === 'increase' ? quantity : -quantity;

      await inventoryService.createMovement({
        movement_type: movementType,
        qty_signed: qtySigned,
        warehouse_id: selectedWarehouse.id,
        product_id: selectedProduct,
        user_id: operatorId,
        ref_type: 'adjustment',
        ref_id: null,
        description: `Ajuste manual: ${adjustmentType === 'increase' ? 'Incremento' : 'Decremento'}`,
        notes: reason
      });

      const newStock = currentStock + qtySigned;

      toast.success(
        adjustmentType === 'increase'
          ? `+${quantity} unidades agregadas. Nuevo stock: ${newStock}`
          : `-${quantity} unidades descontadas. Nuevo stock: ${newStock}`
      );

      // Limpiar formulario
      setSelectedProduct('');
      setCurrentStock(null);
      setQuantity(1);
      setReason('');

      // Redirigir a inventario
      setTimeout(() => {
        navigate('/wms/inventory');
      }, 1500);

    } catch (error) {
      console.error('❌ Error al crear ajuste:', error);
      toast.error(error.message || 'Error al procesar el ajuste');
    } finally {
      setIsProcessing(false);
    }
  };

  const newStock = currentStock !== null
    ? currentStock + (adjustmentType === 'increase' ? quantity : -quantity)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <button
          onClick={() => navigate('/wms')}
          className="mb-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Title Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-orange-500/20">
              <FileEdit className="w-8 h-8 text-orange-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Ajuste de Inventario
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {selectedWarehouse?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Product Selection */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <label className="block text-white/80 font-medium mb-3">Producto</label>
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

            {/* Current Stock Display */}
            {currentStock !== null && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/60 text-xs mb-1">Stock Actual</p>
                <p className="text-white text-2xl font-bold">{currentStock} unidades</p>
              </div>
            )}
          </div>

          {/* Adjustment Type */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <label className="block text-white/80 font-medium mb-3">Tipo de Ajuste</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAdjustmentType('increase')}
                className={`
                  p-4 rounded-2xl border-2 transition-all
                  ${adjustmentType === 'increase'
                    ? 'bg-green-500/20 border-green-500 text-green-300'
                    : 'bg-white/5 border-white/10 text-white/60'
                  }
                  hover:border-green-500/50
                `}
              >
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Incrementar</p>
                <p className="text-xs mt-1 opacity-80">Agregar stock</p>
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('decrease')}
                className={`
                  p-4 rounded-2xl border-2 transition-all
                  ${adjustmentType === 'decrease'
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-white/5 border-white/10 text-white/60'
                  }
                  hover:border-red-500/50
                `}
              >
                <TrendingDown className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Disminuir</p>
                <p className="text-xs mt-1 opacity-80">Descontar stock</p>
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <label className="block text-white/80 font-medium mb-3">Cantidad</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              required
            />

            {/* New Stock Preview */}
            {newStock !== null && currentStock !== null && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs mb-1">Nuevo Stock</p>
                  <p className={`
                    text-2xl font-bold
                    ${adjustmentType === 'increase' ? 'text-green-400' : 'text-orange-400'}
                  `}>
                    {currentStock} {adjustmentType === 'increase' ? '+' : '-'} {quantity} = {newStock}
                  </p>
                </div>
                {adjustmentType === 'increase' ? (
                  <TrendingUp className="w-8 h-8 text-green-400" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-red-400" />
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <label className="block text-white/80 font-medium mb-3">
              Razón del Ajuste <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Conteo físico, Producto dañado, Corrección de inventario..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
              required
            />
            <p className="text-white/40 text-xs mt-2">
              La razón quedará registrada para auditoría
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isProcessing || !selectedProduct || isLoadingProducts}
            className={`
              w-full px-6 py-4 rounded-2xl
              font-medium
              flex items-center justify-center gap-2
              transition-all
              ${adjustmentType === 'increase'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-400/30 hover:shadow-green-500/20'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 border-orange-400/30 hover:shadow-orange-500/20'
              }
              text-white
              hover:shadow-lg
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
                Confirmar Ajuste
              </>
            )}
          </button>

          <p className="text-center text-white/40 text-sm">
            {adjustmentType === 'increase'
              ? 'El stock se incrementará inmediatamente'
              : 'El stock se reducirá inmediatamente'
            }
          </p>
        </form>
      </div>
    </div>
  );
}

export default AdjustmentForm;
