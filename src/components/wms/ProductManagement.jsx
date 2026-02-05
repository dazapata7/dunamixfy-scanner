// =====================================================
// PRODUCT MANAGEMENT - Dunamix WMS
// =====================================================
// Gestión completa de productos: Crear, Editar, Eliminar
// Solo para administradores
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsService } from '../../services/wmsService';
import {
  ArrowLeft,
  Package,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Image as ImageIcon,
  Barcode as BarcodeIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ProductManagement() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    barcode: '',
    photo_url: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const data = await productsService.getAll();
      setProducts(data);
    } catch (error) {
      console.error('❌ Error al cargar productos:', error);
      toast.error('Error al cargar productos');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCreate() {
    setIsCreating(true);
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      barcode: '',
      photo_url: '',
      description: '',
      is_active: true
    });
  }

  function handleEdit(product) {
    setIsCreating(false);
    setEditingProduct(product.id);
    setFormData({
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || '',
      photo_url: product.photo_url || '',
      description: product.description || '',
      is_active: product.is_active
    });
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      barcode: '',
      photo_url: '',
      description: '',
      is_active: true
    });
  }

  async function handleSave() {
    // Validaciones
    if (!formData.sku || !formData.name) {
      toast.error('SKU y nombre son requeridos');
      return;
    }

    try {
      if (isCreating) {
        // Crear nuevo
        await productsService.create(formData);
        toast.success('Producto creado exitosamente');
      } else {
        // Actualizar existente
        await productsService.update(editingProduct, formData);
        toast.success('Producto actualizado exitosamente');
      }

      handleCancel();
      loadProducts();
    } catch (error) {
      console.error('❌ Error al guardar producto:', error);
      toast.error(error.message || 'Error al guardar producto');
    }
  }

  async function handleDelete(product) {
    if (!confirm(`¿Estás seguro de eliminar el producto "${product.name}"?\n\nNOTA: Solo se puede eliminar si no tiene movimientos de inventario.`)) {
      return;
    }

    try {
      await productsService.delete(product.id);
      toast.success('Producto eliminado');
      loadProducts();
    } catch (error) {
      console.error('❌ Error al eliminar producto:', error);
      toast.error(error.message || 'Error al eliminar producto');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-6xl mx-auto">

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-purple-500/20">
                <Package className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Gestión de Productos
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  Crear, editar y eliminar productos del catálogo
                </p>
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nuevo Producto
            </button>
          </div>
        </div>

        {/* Form (Crear o Editar) */}
        {(isCreating || editingProduct) && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {isCreating ? 'Crear Producto' : 'Editar Producto'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SKU */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  SKU * <span className="text-white/40">(ej: PROD-001)</span>
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  placeholder="PROD-001"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  disabled={!isCreating} // No permitir cambiar SKU en edición
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del producto"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Código de Barras (Opcional)
                </label>
                <div className="relative">
                  <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="7891234567890"
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Photo URL */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  URL de Foto (Opcional)
                </label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={formData.photo_url}
                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                    placeholder="https://ejemplo.com/foto.jpg"
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="md:col-span-2">
                <label className="block text-white/80 text-sm mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción del producto"
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              </div>

              {/* Activo */}
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-2 focus:ring-purple-500/50"
                />
                <label htmlFor="is_active" className="text-white/80 text-sm">
                  Producto activo
                </label>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-6 border-t border-white/10 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-all"
              >
                <Save className="w-5 h-5" />
                Guardar
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
          </div>
        )}

        {/* Products List */}
        {!isLoading && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg">
            <h2 className="text-xl font-bold text-white mb-4">
              Productos ({products.length})
            </h2>

            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/40">No hay productos creados</p>
                <button
                  onClick={handleCreate}
                  className="mt-4 px-6 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all"
                >
                  Crear primer producto
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white/5 rounded-2xl border border-white/10 p-4 hover:bg-white/10 transition-all"
                  >
                    {/* Photo */}
                    {product.photo_url ? (
                      <img
                        src={product.photo_url}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded-xl mb-3 border border-white/10"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-32 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 ${product.photo_url ? 'hidden' : 'flex'}`}
                    >
                      <Package className="w-12 h-12 text-white/20" />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {product.name}
                          </h3>
                          <p className="text-white/40 text-sm mb-1">
                            SKU: {product.sku}
                          </p>
                          {product.barcode && (
                            <p className="text-white/60 text-xs flex items-center gap-1">
                              <BarcodeIcon className="w-3 h-3" />
                              {product.barcode}
                            </p>
                          )}
                        </div>
                        {product.is_active ? (
                          <span className="px-2 py-0.5 rounded-lg text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                            Inactivo
                          </span>
                        )}
                      </div>

                      {product.description && (
                        <p className="text-white/60 text-sm mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                        <button
                          onClick={() => handleEdit(product)}
                          className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all text-sm"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all text-sm"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default ProductManagement;
