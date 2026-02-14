// =====================================================
// RECEIPT FORM - Dunamix WMS
// =====================================================
// Formulario de entrada de inventario
// Selección de productos y confirmación
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { productsService, receiptsService } from '../../services/wmsService';
import { ArrowLeft, Package, Plus, Trash2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function ReceiptForm() {
  const navigate = useNavigate();
  const { selectedWarehouse, operatorId } = useStore();

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
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

  const handleAddItem = () => {
    setItems([...items, { product_id: '', qty: 1, notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (items.length === 0) {
      toast.error('Debe agregar al menos un producto');
      return;
    }

    const invalidItems = items.filter(item => !item.product_id || item.qty <= 0);
    if (invalidItems.length > 0) {
      toast.error('Todos los items deben tener producto y cantidad válida');
      return;
    }

    setIsProcessing(true);

    try {
      // Crear recibo
      const receipt = await receiptsService.create({
        warehouse_id: selectedWarehouse.id,
        operator_id: operatorId,
        notes
      }, items);

      toast.success(`Recibo ${receipt.receipt_number} creado`);

      // Confirmar automáticamente
      await receiptsService.confirm(receipt.id);

      toast.success('Inventario actualizado exitosamente');

      // Redirigir a inventario
      navigate('/wms/inventory');

    } catch (error) {
      console.error('❌ Error al crear recibo:', error);
      toast.error(error.message || 'Error al procesar la entrada');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-3xl mx-auto">

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
            <div className="p-4 rounded-2xl bg-green-500/20">
              <Package className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Entrada de Inventario
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {selectedWarehouse?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Items */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Productos</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                Agregar producto
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <Package className="w-12 h-12 mx-auto mb-3 text-white/40" />
                <p>No hay productos agregados</p>
                <p className="text-sm mt-1">Click en "Agregar producto" para empezar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="grid grid-cols-12 gap-3">
                      {/* Product Select */}
                      <div className="col-span-6">
                        <label className="block text-white/60 text-xs mb-2">Producto</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                          style={{ colorScheme: 'dark' }}
                          required
                        >
                          <option value="" style={{ backgroundColor: '#1a1a1a', color: '#999' }}>Seleccionar...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
                              {p.sku} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-3">
                        <label className="block text-white/60 text-xs mb-2">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                          required
                        />
                      </div>

                      {/* Delete */}
                      <div className="col-span-3 flex items-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-3">
                      <label className="block text-white/60 text-xs mb-2">Notas (opcional)</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                        placeholder="Ej: Lote ABC123"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* General Notes */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-glass-lg">
            <label className="block text-white/80 font-medium mb-3">Observaciones Generales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Recibido de proveedor XYZ, Factura #12345"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isProcessing || items.length === 0 || isLoadingProducts}
            className="
              w-full px-6 py-4 rounded-2xl
              bg-gradient-to-r from-green-500 to-emerald-500
              border border-green-400/30
              text-white font-medium
              hover:shadow-lg hover:shadow-green-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
              flex items-center justify-center gap-2
            "
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Confirmar Entrada
              </>
            )}
          </button>

          <p className="text-center text-white/40 text-sm">
            El inventario se actualizará automáticamente al confirmar
          </p>
        </form>
      </div>
    </div>
  );
}

export default ReceiptForm;
