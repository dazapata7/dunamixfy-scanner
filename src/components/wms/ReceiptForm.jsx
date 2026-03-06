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

        {/* Layout desktop: dos columnas | móvil: columna única */}
        <form onSubmit={handleSubmit}>
          <div className="lg:grid lg:grid-cols-[1fr,320px] lg:gap-6 space-y-4 lg:space-y-0">

            {/* ── Columna izquierda: tabla de ítems ── */}
            <div className="bg-dark-900 rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <h2 className="text-white font-semibold text-sm">Productos a ingresar</h2>
                  <p className="text-white/30 text-xs mt-0.5">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="w-12 h-12 mx-auto mb-3 text-white/20" />
                  <p className="text-white/40 text-sm">Sin productos todavía</p>
                  <button type="button" onClick={handleAddItem}
                    className="mt-3 text-emerald-400 text-sm hover:underline">
                    Agregar el primero
                  </button>
                </div>
              ) : (
                <>
                  {/* DESKTOP: tabla */}
                  <table className="hidden lg:table w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/3">
                        <th className="px-4 py-2.5 text-left text-white/40 font-medium text-xs">#</th>
                        <th className="px-4 py-2.5 text-left text-white/40 font-medium text-xs">Producto</th>
                        <th className="px-4 py-2.5 text-left text-white/40 font-medium text-xs w-28">Cantidad</th>
                        <th className="px-4 py-2.5 text-left text-white/40 font-medium text-xs">Notas</th>
                        <th className="px-4 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-white/30 text-xs">{index + 1}</td>
                          <td className="px-4 py-3">
                            <select value={item.product_id}
                              onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50"
                              style={{ colorScheme: 'dark' }} required>
                              <option value="">Seleccionar...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" min="1" value={item.qty}
                              onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:outline-none focus:border-green-500/50"
                              required />
                          </td>
                          <td className="px-4 py-3">
                            <input type="text" value={item.notes}
                              onChange={e => handleItemChange(index, 'notes', e.target.value)}
                              placeholder="Lote, proveedor..."
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-green-500/50" />
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => handleRemoveItem(index)}
                              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MÓVIL: cards */}
                  <div className="lg:hidden divide-y divide-white/5">
                    {items.map((item, index) => (
                      <div key={index} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white/30 text-xs">Ítem {index + 1}</span>
                          <button type="button" onClick={() => handleRemoveItem(index)}
                            className="p-1.5 rounded-lg text-red-300 hover:bg-red-500/10 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <select value={item.product_id}
                          onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none"
                          style={{ colorScheme: 'dark' }} required>
                          <option value="">Seleccionar producto...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-white/50 text-xs mb-1">Cantidad</label>
                            <input type="number" min="1" value={item.qty}
                              onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none" required />
                          </div>
                          <div>
                            <label className="block text-white/50 text-xs mb-1">Notas</label>
                            <input type="text" value={item.notes}
                              onChange={e => handleItemChange(index, 'notes', e.target.value)}
                              placeholder="Lote..."
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Columna derecha: resumen + notas + submit ── */}
            <div className="space-y-4">

              {/* Resumen */}
              {items.length > 0 && (
                <div className="bg-dark-900 rounded-2xl border border-white/[0.06] p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Resumen</p>
                  <div className="space-y-2">
                    {items.filter(i => i.product_id).map((item, i) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-white/70 truncate flex-1 mr-2">{prod?.name || 'Producto'}</span>
                          <span className="text-green-400 font-bold tabular-nums">+{item.qty}</span>
                        </div>
                      );
                    })}
                  </div>
                  {items.filter(i => i.product_id).length > 0 && (
                    <div className="border-t border-white/10 mt-3 pt-3 flex items-center justify-between text-sm">
                      <span className="text-white/50">Total unidades</span>
                      <span className="text-white font-bold tabular-nums">
                        {items.filter(i => i.product_id).reduce((sum, i) => sum + (i.qty || 0), 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Observaciones generales */}
              <div className="bg-dark-900 rounded-2xl border border-white/[0.06] p-5">
                <label className="block text-white/70 text-xs uppercase tracking-wider mb-3">Observaciones</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Recibido de proveedor XYZ, Factura #12345"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none text-sm"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isProcessing || items.length === 0 || isLoadingProducts}
                className="
                  w-full px-6 py-4 rounded-xl
                  bg-gradient-to-r from-green-500 to-emerald-500
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
              <p className="text-center text-white/30 text-xs">El inventario se actualiza automáticamente</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReceiptForm;
