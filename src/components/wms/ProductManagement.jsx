// =====================================================
// PRODUCT MANAGEMENT - Dunamix WMS
// =====================================================
// Gestión completa de productos: Crear, Editar, Eliminar
// Solo para administradores
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsService, skuMappingsService, comboProductsService } from '../../services/wmsService';
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
  Barcode as BarcodeIcon,
  Link as LinkIcon
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
    is_active: true,
    type: 'simple'  // ⭐ NUEVO: Tipo de producto (simple/combo)
  });

  // SKU Mappings state
  const [skuMappings, setSkuMappings] = useState([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [newMapping, setNewMapping] = useState({
    source: 'dunamixfy',
    external_sku: '',
    notes: ''
  });

  // ⭐ NUEVO: Combo components state
  const [comboComponents, setComboComponents] = useState([]);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);

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
      is_active: true,
      type: 'simple'  // ⭐ NUEVO
    });
    setComboComponents([]);  // ⭐ NUEVO: Limpiar componentes
  }

  async function handleEdit(product) {
    setIsCreating(false);
    setEditingProduct(product.id);
    setFormData({
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || '',
      photo_url: product.photo_url || '',
      description: product.description || '',
      is_active: product.is_active,
      type: product.type || 'simple'  // ⭐ NUEVO
    });

    // Cargar SKU mappings del producto
    await loadSkuMappings(product.id);

    // ⭐ NUEVO: Cargar componentes si es combo
    if (product.type === 'combo') {
      await loadComboComponents(product.id);
    } else {
      setComboComponents([]);
    }
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
      is_active: true,
      type: 'simple'  // ⭐ NUEVO
    });
    setSkuMappings([]);
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
    setComboComponents([]);  // ⭐ NUEVO
  }

  async function loadSkuMappings(productId) {
    setIsLoadingMappings(true);
    try {
      const mappings = await skuMappingsService.getByProductId(productId);
      setSkuMappings(mappings);
    } catch (error) {
      console.error('❌ Error al cargar mappings:', error);
      toast.error('Error al cargar SKU externos');
    } finally {
      setIsLoadingMappings(false);
    }
  }

  // ⭐ NUEVO: Cargar componentes del combo
  async function loadComboComponents(comboProductId) {
    setIsLoadingComponents(true);
    try {
      const components = await comboProductsService.getComponents(comboProductId);
      setComboComponents(components.map(c => ({
        id: c.id,
        product_id: c.component.id,
        product_name: c.component.name,
        quantity: c.quantity
      })));

      // Cargar productos disponibles (solo simples)
      const allProducts = await productsService.getAll();
      setAvailableProducts(allProducts.filter(p => p.type === 'simple' && p.id !== comboProductId));
    } catch (error) {
      console.error('❌ Error al cargar componentes:', error);
      toast.error('Error al cargar componentes del combo');
    } finally {
      setIsLoadingComponents(false);
    }
  }

  // ⭐ NUEVO: Agregar componente al combo
  function handleAddComponent() {
    setComboComponents([...comboComponents, { product_id: '', quantity: 1 }]);
  }

  // ⭐ NUEVO: Remover componente del combo
  function handleRemoveComponent(index) {
    setComboComponents(comboComponents.filter((_, i) => i !== index));
  }

  // ⭐ NUEVO: Actualizar componente
  function handleUpdateComponent(index, field, value) {
    const updated = [...comboComponents];
    updated[index][field] = value;
    setComboComponents(updated);
  }

  async function handleAddMapping() {
    if (!newMapping.external_sku.trim()) {
      toast.error('El SKU externo es requerido');
      return;
    }

    if (!editingProduct) {
      toast.error('Debe guardar el producto primero');
      return;
    }

    try {
      // VALIDACIÓN: Verificar si el SKU externo ya existe en OTRO producto
      const allMappings = await skuMappingsService.getAll();
      const duplicateInOtherProduct = allMappings.find(
        m => m.source === newMapping.source &&
             m.external_sku.toUpperCase() === newMapping.external_sku.trim().toUpperCase() &&
             m.product_id !== editingProduct
      );

      if (duplicateInOtherProduct) {
        // Obtener nombre del producto donde ya existe
        const productWithDuplicate = products.find(p => p.id === duplicateInOtherProduct.product_id);
        const productName = productWithDuplicate?.name || 'otro producto';

        toast.error(
          `❌ El SKU "${newMapping.external_sku}" de ${newMapping.source === 'dunamixfy' ? 'Coordinadora' : 'Interrápidisimo'} ya está asignado a: ${productName}`,
          { duration: 5000 }
        );
        return;
      }

      await skuMappingsService.create({
        product_id: editingProduct,
        source: newMapping.source,
        external_sku: newMapping.external_sku.trim().toUpperCase(),
        notes: newMapping.notes.trim() || null,
        is_active: true
      });

      toast.success('SKU externo agregado');
      setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
      await loadSkuMappings(editingProduct);
    } catch (error) {
      console.error('❌ Error al agregar mapping:', error);
      if (error.code === '23505') {
        toast.error('Este SKU externo ya existe para esta fuente');
      } else {
        toast.error(error.message || 'Error al agregar SKU externo');
      }
    }
  }

  async function handleDeleteMapping(mappingId) {
    if (!confirm('¿Eliminar este SKU externo?')) {
      return;
    }

    try {
      await skuMappingsService.delete(mappingId);
      toast.success('SKU externo eliminado');
      await loadSkuMappings(editingProduct);
    } catch (error) {
      console.error('❌ Error al eliminar mapping:', error);
      toast.error(error.message || 'Error al eliminar SKU externo');
    }
  }

  async function handleSave() {
    // Validaciones
    if (!formData.sku || !formData.name) {
      toast.error('SKU y nombre son requeridos');
      return;
    }

    // ⭐ NUEVO: Validar que combo tenga al menos 1 componente
    if (formData.type === 'combo' && comboComponents.length === 0) {
      toast.error('Un combo debe tener al menos 1 componente');
      return;
    }

    // ⭐ NUEVO: Validar que todos los componentes tengan producto y cantidad
    if (formData.type === 'combo') {
      const invalidComponents = comboComponents.filter(c => !c.product_id || c.quantity < 1);
      if (invalidComponents.length > 0) {
        toast.error('Todos los componentes deben tener un producto y cantidad válida');
        return;
      }
    }

    try {
      let productId = editingProduct;

      if (isCreating) {
        // Crear nuevo
        const newProduct = await productsService.create(formData);
        productId = newProduct.id;
        toast.success('Producto creado exitosamente');
      } else {
        // Actualizar existente
        await productsService.update(editingProduct, formData);
        toast.success('Producto actualizado exitosamente');
      }

      // ⭐ NUEVO: Guardar componentes si es combo
      if (formData.type === 'combo') {
        await comboProductsService.setComponents(productId, comboComponents);
        console.log(`✅ Componentes guardados para combo ${productId}`);
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

              {/* ⭐ NUEVO: Tipo de Producto */}
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Tipo de Producto *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  disabled={!isCreating} // No permitir cambiar tipo en edición
                >
                  <option value="simple">Simple (Producto Individual)</option>
                  <option value="combo">Combo (Compuesto de otros productos)</option>
                </select>
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

            {/* ⭐ NUEVO: Componentes del Combo */}
            {formData.type === 'combo' && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">📦 Componentes del Combo</h3>
                    <p className="text-white/60 text-sm">Define qué productos y cantidades forman este combo</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (availableProducts.length === 0) {
                        const allProducts = await productsService.getAll();
                        setAvailableProducts(allProducts.filter(p => p.type === 'simple'));
                      }
                      handleAddComponent();
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Componente
                  </button>
                </div>

                {comboComponents.length === 0 ? (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
                    <Package className="w-12 h-12 text-white/20 mx-auto mb-2" />
                    <p className="text-white/60 text-sm">Sin componentes. Haz clic en "Agregar Componente" para comenzar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comboComponents.map((component, index) => (
                      <div key={index} className="bg-white/5 rounded-xl border border-white/10 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          {/* Producto */}
                          <div className="md:col-span-2">
                            <label className="block text-white/60 text-xs mb-1">Producto *</label>
                            <select
                              value={component.product_id}
                              onChange={(e) => {
                                const selectedProduct = availableProducts.find(p => p.id === e.target.value);
                                handleUpdateComponent(index, 'product_id', e.target.value);
                                if (selectedProduct) {
                                  handleUpdateComponent(index, 'product_name', selectedProduct.name);
                                }
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                              <option value="">Selecciona un producto...</option>
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                              ))}
                            </select>
                          </div>

                          {/* Cantidad */}
                          <div>
                            <label className="block text-white/60 text-xs mb-1">Cantidad *</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                value={component.quantity}
                                onChange={(e) => handleUpdateComponent(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              />
                              <button
                                onClick={() => handleRemoveComponent(index)}
                                className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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

        {/* SKU Mappings - Solo mostrar al editar un producto existente */}
        {editingProduct && !isCreating && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-6 h-6 text-blue-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">SKU Externos</h2>
                  <p className="text-white/60 text-sm">Mapeo de SKUs de Dunamixfy e Interrápidisimo</p>
                </div>
              </div>
            </div>

            {/* Agregar nuevo mapping */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-4">
              <p className="text-white/80 font-medium mb-3">➕ Agregar SKU Externo</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Source */}
                <div>
                  <label className="block text-white/60 text-xs mb-1">Fuente</label>
                  <select
                    value={newMapping.source}
                    onChange={(e) => setNewMapping({ ...newMapping, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="dunamixfy">Coordinadora (Dunamixfy)</option>
                    <option value="interrapidisimo">Interrápidisimo</option>
                  </select>
                </div>

                {/* External SKU */}
                <div>
                  <label className="block text-white/60 text-xs mb-1">SKU Externo *</label>
                  <input
                    type="text"
                    value={newMapping.external_sku}
                    onChange={(e) => setNewMapping({ ...newMapping, external_sku: e.target.value })}
                    placeholder="Ej: 210, ABC-123"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-white/60 text-xs mb-1">Notas (Opcional)</label>
                  <input
                    type="text"
                    value={newMapping.notes}
                    onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })}
                    placeholder="Notas adicionales"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <button
                onClick={handleAddMapping}
                className="mt-3 w-full md:w-auto px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Agregar Mapping
              </button>
            </div>

            {/* Lista de mappings existentes */}
            {isLoadingMappings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
              </div>
            ) : skuMappings.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <p>No hay SKU externos configurados</p>
                <p className="text-xs mt-1">Agrega el primer mapping arriba</p>
              </div>
            ) : (
              <div className="space-y-2">
                {skuMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between bg-white/5 rounded-xl border border-white/10 p-3 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Source Badge */}
                      <div className={`
                        px-3 py-1 rounded-lg text-xs font-medium
                        ${mapping.source === 'dunamixfy' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : ''}
                        ${mapping.source === 'interrapidisimo' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : ''}
                        ${!['dunamixfy', 'interrapidisimo'].includes(mapping.source) ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' : ''}
                      `}>
                        {mapping.source === 'dunamixfy' ? 'Dunamixfy' :
                         mapping.source === 'interrapidisimo' ? 'Interrápidisimo' :
                         mapping.source.toUpperCase()}
                      </div>

                      {/* External SKU */}
                      <div className="flex-1">
                        <p className="text-white font-mono font-bold">{mapping.external_sku}</p>
                        {mapping.notes && (
                          <p className="text-white/60 text-xs mt-0.5">{mapping.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteMapping(mapping.id)}
                      className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
