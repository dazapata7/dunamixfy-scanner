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

const inputCls = "bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full";

export function ReceiptForm() {
  const navigate = useNavigate();
  const { selectedWarehouse, operatorId } = useStore();

  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!selectedWarehouse) {
      toast.error('Debe seleccionar un almacén primero');
      navigate('/wms/select-warehouse');
    }
  }, [selectedWarehouse, navigate]);

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
      const receipt = await receiptsService.create({
        warehouse_id: selectedWarehouse.id,
        operator_id: operatorId,
        notes
      }, items);

      toast.success(`Recibo ${receipt.receipt_number} creado`);
      await receiptsService.confirm(receipt.id);
      toast.success('Inventario actualizado exitosamente');
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
      <div className="max-w-[1100px] mx-auto space-y-5">

        {/* Volver – solo móvil */}
        <button
          onClick={() => navigate('/wms')}
          className="lg:hidden bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <form onSubmit={handleSubmit}>
          <div className="lg:grid lg:grid-cols-[1fr,320px] lg:gap-6 space-y-4 lg:space-y-0">

            {/* ── Columna izquierda: tabla de ítems ── */}
            <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-white font-semibold text-base">Productos a ingresar</h2>
                  <p className="text-white/40 text-sm mt-0.5">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Sin productos todavía</p>
                  <button type="button" onClick={handleAddItem}
                    className="mt-3 text-primary-400/70 text-sm hover:text-primary-400 transition-colors">
                    Agregar el primero
                  </button>
                </div>
              ) : (
                <>
                  {/* DESKTOP: tabla */}
                  <table className="hidden lg:table w-full">
                    <thead>
                      <tr className="border-b border-white/[0.05] bg-black/20">
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-8">#</th>
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Producto</th>
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-28">Cantidad</th>
                        <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Notas</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {items.map((item, index) => (
                        <tr key={index} className="hover:bg-primary-500/[0.03] transition-colors">
                          <td className="px-4 py-3 text-white/30 text-sm">{index + 1}</td>
                          <td className="px-4 py-3">
                            <select value={item.product_id}
                              onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                              className={inputCls}
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
                              className={`${inputCls} text-center`}
                              required />
                          </td>
                          <td className="px-4 py-3">
                            <input type="text" value={item.notes}
                              onChange={e => handleItemChange(index, 'notes', e.target.value)}
                              placeholder="Lote, proveedor..."
                              className={inputCls} />
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => handleRemoveItem(index)}
                              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MÓVIL: cards */}
                  <div className="lg:hidden divide-y divide-white/[0.03]">
                    {items.map((item, index) => (
                      <div key={index} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white/25 text-[11px] uppercase tracking-[0.12em]">Ítem {index + 1}</span>
                          <button type="button" onClick={() => handleRemoveItem(index)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <select value={item.product_id}
                          onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                          className={inputCls}
                          style={{ colorScheme: 'dark' }} required>
                          <option value="">Seleccionar producto...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Cantidad</label>
                            <input type="number" min="1" value={item.qty}
                              onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value))}
                              className={inputCls} required />
                          </div>
                          <div>
                            <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Notas</label>
                            <input type="text" value={item.notes}
                              onChange={e => handleItemChange(index, 'notes', e.target.value)}
                              placeholder="Lote..."
                              className={inputCls} />
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
                <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
                  <p className="text-white/25 text-[11px] uppercase tracking-[0.12em] mb-3">Resumen</p>
                  <div className="space-y-2">
                    {items.filter(i => i.product_id).map((item, i) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-white/60 truncate flex-1 mr-2">{prod?.name || 'Producto'}</span>
                          <span className="text-primary-400 font-bold tabular-nums">+{item.qty}</span>
                        </div>
                      );
                    })}
                  </div>
                  {items.filter(i => i.product_id).length > 0 && (
                    <div className="border-t border-white/[0.06] mt-3 pt-3 flex items-center justify-between text-sm">
                      <span className="text-white/40">Total unidades</span>
                      <span className="text-white font-bold tabular-nums">
                        {items.filter(i => i.product_id).reduce((sum, i) => sum + (i.qty || 0), 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Observaciones generales */}
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-5">
                <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-3">Observaciones</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Recibido de proveedor XYZ, Factura #12345"
                  rows={4}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isProcessing || items.length === 0 || isLoadingProducts}
                className="w-full bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-3 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
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
