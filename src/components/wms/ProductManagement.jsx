// =====================================================
// PRODUCT MANAGEMENT - Dunamix WMS
// =====================================================
// Desktop: lista tipo tabla con fotos en fila + modal para crear/editar
// Móvil: cards compactas
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
  Link as LinkIcon,
  Search,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Badge de tipo ──────────────────────────────────
const TypeBadge = ({ type }) => type === 'combo'
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-semibold">Combo</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">Simple</span>;

// ── Badge de estado ────────────────────────────────
const StatusBadge = ({ active }) => active
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold">Activo</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">Inactivo</span>;

// ── Thumbnail de producto ──────────────────────────
const ProductThumb = ({ src, name, size = 'md' }) => {
  const [err, setErr] = useState(false);
  const cls = size === 'sm'
    ? 'w-10 h-10 rounded-lg flex-shrink-0'
    : 'w-14 h-14 rounded-xl flex-shrink-0';
  if (src && !err) {
    return <img src={src} alt={name} className={`${cls} object-cover border border-white/10`} onError={() => setErr(true)} />;
  }
  return (
    <div className={`${cls} bg-white/5 border border-white/10 flex items-center justify-center`}>
      <Package className={size === 'sm' ? 'w-4 h-4 text-white/20' : 'w-6 h-6 text-white/20'} />
    </div>
  );
};

// ── Source Badge ───────────────────────────────────
const SourceBadge = ({ source }) => {
  if (source === 'dunamixfy') return <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">Dunamixfy</span>;
  if (source === 'interrapidisimo') return <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">Interrápidisimo</span>;
  return <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/50 border border-white/20">{source}</span>;
};

// ─────────────────────────────────────────────────
export function ProductManagement() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = creating
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    sku: '', name: '', barcode: '', photo_url: '',
    description: '', is_active: true, type: 'simple'
  });

  // SKU Mappings
  const [skuMappings, setSkuMappings] = useState([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [newMapping, setNewMapping] = useState({ source: 'dunamixfy', external_sku: '', notes: '' });

  // Combo components
  const [comboComponents, setComboComponents] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const data = await productsService.getAll();
      setProducts(data);
    } catch { toast.error('Error al cargar productos'); }
    finally { setIsLoading(false); }
  }

  // ── Abrir modal (crear) ───────────────────────────
  async function openCreate() {
    setEditingProduct(null);
    setFormData({ sku: '', name: '', barcode: '', photo_url: '', description: '', is_active: true, type: 'simple' });
    setSkuMappings([]);
    setComboComponents([]);
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
    try {
      const all = await productsService.getAll();
      setAvailableProducts(all.filter(p => p.type === 'simple' || !p.type));
    } catch { /* ignore */ }
    setShowModal(true);
  }

  // ── Abrir modal (editar) ──────────────────────────
  async function openEdit(product) {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || '',
      photo_url: product.photo_url || '',
      description: product.description || '',
      is_active: product.is_active,
      type: product.type || 'simple'
    });
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });

    // Cargar mappings y componentes en paralelo
    setIsLoadingMappings(true);
    try {
      const [mappings, allProds] = await Promise.all([
        skuMappingsService.getByProductId(product.id),
        productsService.getAll()
      ]);
      setSkuMappings(mappings);
      setAvailableProducts(allProds.filter(p => p.type === 'simple' && p.id !== product.id));

      if (product.type === 'combo') {
        const components = await comboProductsService.getComponents(product.id);
        setComboComponents(components.map(c => ({
          id: c.id, product_id: c.component.id,
          product_name: c.component.name, quantity: c.quantity
        })));
      } else {
        setComboComponents([]);
      }
    } catch { toast.error('Error al cargar datos del producto'); }
    finally { setIsLoadingMappings(false); }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProduct(null);
  }

  // ── Guardar ───────────────────────────────────────
  async function handleSave() {
    if (!formData.sku || !formData.name) { toast.error('SKU y nombre son requeridos'); return; }
    if (formData.type === 'combo' && comboComponents.length === 0) { toast.error('Un combo debe tener al menos 1 componente'); return; }
    if (formData.type === 'combo' && comboComponents.some(c => !c.product_id || c.quantity < 1)) {
      toast.error('Todos los componentes deben tener producto y cantidad válida'); return;
    }

    setIsSaving(true);
    try {
      let productId = editingProduct?.id;
      const isCreating = !productId;

      if (isCreating) {
        const newProd = await productsService.create(formData);
        productId = newProd.id;
      } else {
        await productsService.update(productId, formData);
      }

      if (formData.type === 'combo') {
        await comboProductsService.setComponents(productId, comboComponents);
      }

      if (isCreating && skuMappings.length > 0) {
        for (const m of skuMappings) {
          try {
            await skuMappingsService.create({
              product_id: productId, source: m.source,
              external_sku: m.external_sku.trim().toUpperCase(),
              notes: m.notes?.trim() || null, is_active: true
            });
          } catch { /* ignore individual errors */ }
        }
      }

      toast.success(isCreating ? 'Producto creado' : 'Producto actualizado');
      closeModal();
      loadProducts();
    } catch (error) {
      toast.error(error.message || 'Error al guardar producto');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Eliminar ──────────────────────────────────────
  async function handleDelete(product) {
    if (!confirm(`¿Eliminar "${product.name}"?\n\nSolo se puede eliminar si no tiene movimientos de inventario.`)) return;
    try {
      await productsService.delete(product.id);
      toast.success('Producto eliminado');
      loadProducts();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar producto');
    }
  }

  // ── SKU Mappings ──────────────────────────────────
  async function handleAddMapping() {
    if (!newMapping.external_sku.trim()) { toast.error('El SKU externo es requerido'); return; }

    const isCreating = !editingProduct;
    if (isCreating) {
      const dup = skuMappings.find(m => m.source === newMapping.source && m.external_sku.toUpperCase() === newMapping.external_sku.trim().toUpperCase());
      if (dup) { toast.error('Este SKU externo ya fue agregado'); return; }
      setSkuMappings([...skuMappings, {
        id: `temp-${Date.now()}`, source: newMapping.source,
        external_sku: newMapping.external_sku.trim().toUpperCase(),
        notes: newMapping.notes.trim() || null, is_active: true
      }]);
      setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
      return;
    }

    try {
      const allMappings = await skuMappingsService.getAll();
      const dup = allMappings.find(m => m.source === newMapping.source && m.external_sku.toUpperCase() === newMapping.external_sku.trim().toUpperCase() && m.product_id !== editingProduct.id);
      if (dup) {
        const prod = products.find(p => p.id === dup.product_id);
        toast.error(`SKU ya asignado a: ${prod?.name || 'otro producto'}`, { duration: 5000 });
        return;
      }
      await skuMappingsService.create({
        product_id: editingProduct.id, source: newMapping.source,
        external_sku: newMapping.external_sku.trim().toUpperCase(),
        notes: newMapping.notes.trim() || null, is_active: true
      });
      setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
      const mappings = await skuMappingsService.getByProductId(editingProduct.id);
      setSkuMappings(mappings);
    } catch (error) {
      toast.error(error.code === '23505' ? 'SKU externo ya existe para esta fuente' : (error.message || 'Error al agregar'));
    }
  }

  async function handleDeleteMapping(mappingId) {
    if (!confirm('¿Eliminar este SKU externo?')) return;
    if (!editingProduct) {
      setSkuMappings(skuMappings.filter(m => m.id !== mappingId));
      return;
    }
    try {
      await skuMappingsService.delete(mappingId);
      const mappings = await skuMappingsService.getByProductId(editingProduct.id);
      setSkuMappings(mappings);
    } catch (error) { toast.error(error.message || 'Error al eliminar'); }
  }

  // ── Combo components ──────────────────────────────
  function addComponent() { setComboComponents([...comboComponents, { product_id: '', quantity: 1 }]); }
  function removeComponent(i) { setComboComponents(comboComponents.filter((_, idx) => idx !== i)); }
  function updateComponent(i, field, value) {
    const updated = [...comboComponents];
    updated[i][field] = value;
    setComboComponents(updated);
  }

  // ── Filtro ────────────────────────────────────────
  const filtered = products.filter(p => {
    const q = searchTerm.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
  });

  const simples = filtered.filter(p => !p.type || p.type === 'simple');
  const combos  = filtered.filter(p => p.type === 'combo');

  // ── Row de producto (desktop tabla) ───────────────
  const ProductRow = ({ product }) => (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors group">
      <td className="px-4 py-3">
        <ProductThumb src={product.photo_url} name={product.name} size="sm" />
      </td>
      <td className="px-4 py-3">
        <p className="text-white/90 font-medium text-sm truncate max-w-[220px]">{product.name}</p>
        <p className="text-white/40 text-xs font-mono">{product.sku}</p>
      </td>
      <td className="px-4 py-3"><TypeBadge type={product.type} /></td>
      <td className="px-4 py-3 font-mono text-white/50 text-xs">{product.barcode || '—'}</td>
      <td className="px-4 py-3"><StatusBadge active={product.is_active} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => openEdit(product)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-xs">
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </button>
          <button onClick={() => handleDelete(product)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all text-xs">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      </td>
    </tr>
  );

  // ── Card de producto (móvil) ───────────────────────
  const ProductCard = ({ product }) => (
    <div className="bg-white/5 rounded-xl border border-white/10 p-3 flex gap-3">
      <ProductThumb src={product.photo_url} name={product.name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{product.name}</p>
            <p className="text-white/40 text-xs font-mono">{product.sku}</p>
          </div>
          <StatusBadge active={product.is_active} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <TypeBadge type={product.type} />
          <div className="flex-1" />
          <button onClick={() => openEdit(product)}
            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDelete(product)}
            className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Sección de tabla (desktop) ────────────────────
  const TableSection = ({ title, items, color }) => (
    items.length === 0 ? null : (
      <>
        <tr>
          <td colSpan={6} className="px-4 pt-5 pb-2">
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${color}`}>{title} ({items.length})</p>
          </td>
        </tr>
        {items.map(p => <ProductRow key={p.id} product={p} />)}
      </>
    )
  );

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1400px] mx-auto">

        {/* Volver – solo móvil */}
        <button onClick={() => navigate('/wms')}
          className="lg:hidden mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Barra superior */}
        <div className="bg-dark-900 rounded-2xl border border-white/[0.06] p-4 mb-4 flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input type="text" placeholder="Buscar por nombre, SKU, código de barras..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary-500/50 transition-all" />
          </div>

          {/* Actualizar */}
          <button onClick={loadProducts} disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {/* Nuevo producto */}
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>

          {/* Contador */}
          <div className="w-full mt-1 text-white/40 text-xs">
            {filtered.length} de {products.length} productos
            {searchTerm && <span className="ml-1.5 text-primary-400">• búsqueda activa</span>}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
          </div>
        )}

        {/* DESKTOP: tabla */}
        {!isLoading && (
          <div className="hidden lg:block bg-dark-900 rounded-2xl border border-white/[0.06] overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-16 text-center">
                <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 mb-4">
                  {searchTerm ? 'No hay productos con esa búsqueda' : 'No hay productos creados'}
                </p>
                {!searchTerm && (
                  <button onClick={openCreate}
                    className="px-6 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm">
                    Crear primer producto
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-16">Foto</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-24">Tipo</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-36">Código de Barras</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-24">Estado</th>
                    <th className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase tracking-wider w-40">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <TableSection title="Productos" items={simples} color="text-cyan-400/60" />
                  <TableSection title="Combos" items={combos} color="text-violet-400/60" />
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MÓVIL: cards */}
        {!isLoading && (
          <div className="lg:hidden space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-10 text-center">
                <Package className="w-10 h-10 text-white/20 mx-auto mb-2" />
                <p className="text-white/50 text-sm">No hay productos</p>
              </div>
            ) : (
              <>
                {simples.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/60 mb-2 px-1">Productos ({simples.length})</p>
                    <div className="space-y-2">{simples.map(p => <ProductCard key={p.id} product={p} />)}</div>
                  </div>
                )}
                {combos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/60 mb-2 px-1">Combos ({combos.length})</p>
                    <div className="space-y-2">{combos.map(p => <ProductCard key={p.id} product={p} />)}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODAL - Crear / Editar Producto
      ══════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base">
                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                  </h2>
                  {editingProduct && <p className="text-white/40 text-xs font-mono">{editingProduct.sku}</p>}
                </div>
              </div>
              <button onClick={closeModal}
                className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/5 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body – scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ── Campos del producto ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">SKU *</label>
                  <input type="text" value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="PROD-001" disabled={!!editingProduct}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50 disabled:opacity-50 transition-all" />
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Nombre *</label>
                  <input type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre del producto"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Tipo</label>
                  <select value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    disabled={!!editingProduct}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 disabled:opacity-50 transition-all">
                    <option value="simple">Simple (Producto Individual)</option>
                    <option value="combo">Combo (Compuesto de otros)</option>
                  </select>
                </div>

                {/* Código de Barras */}
                <div>
                  <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Código de Barras</label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input type="text" value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="7891234567890"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
                  </div>
                </div>

                {/* URL de Foto */}
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">URL de Foto</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input type="text" value={formData.photo_url}
                        onChange={e => setFormData({ ...formData, photo_url: e.target.value })}
                        placeholder="https://ejemplo.com/foto.jpg"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
                    </div>
                    {formData.photo_url && (
                      <ProductThumb src={formData.photo_url} name={formData.name} size="md" />
                    )}
                  </div>
                </div>

                {/* Descripción */}
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-xs mb-1.5 uppercase tracking-wider">Descripción</label>
                  <textarea value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del producto" rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500/50 resize-none transition-all" />
                </div>

                {/* Activo */}
                <div className="md:col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-2 focus:ring-purple-500/50" />
                  <label htmlFor="is_active" className="text-white/70 text-sm">Producto activo</label>
                </div>
              </div>

              {/* ── Componentes del Combo ── */}
              {formData.type === 'combo' && (
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-sm">Componentes del Combo</h3>
                      <p className="text-white/40 text-xs mt-0.5">Productos que forman este combo</p>
                    </div>
                    <button onClick={addComponent}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all text-xs">
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                  {comboComponents.length === 0 ? (
                    <p className="text-center text-white/30 text-sm py-4">Sin componentes aún</p>
                  ) : (
                    <div className="space-y-2">
                      {comboComponents.map((c, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <select value={c.product_id}
                            onChange={e => {
                              const prod = availableProducts.find(p => p.id === e.target.value);
                              updateComponent(i, 'product_id', e.target.value);
                              if (prod) updateComponent(i, 'product_name', prod.name);
                            }}
                            style={{ colorScheme: 'dark' }}
                            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50">
                            <option value="">Selecciona un producto...</option>
                            {availableProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                          <input type="number" min="1" value={c.quantity}
                            onChange={e => updateComponent(i, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 text-center" />
                          <button onClick={() => removeComponent(i)}
                            className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── SKU Externos ── */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <LinkIcon className="w-4 h-4 text-blue-400" />
                  <h3 className="text-white font-semibold text-sm">SKU Externos</h3>
                  <span className="text-white/30 text-xs">Mapeo de Dunamixfy e Interrápidisimo</span>
                </div>

                {/* Agregar mapping */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="min-w-[160px]">
                      <label className="block text-white/50 text-xs mb-1">Fuente</label>
                      <select value={newMapping.source}
                        onChange={e => setNewMapping({ ...newMapping, source: e.target.value })}
                        style={{ colorScheme: 'dark' }}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50">
                        <option value="dunamixfy">Coordinadora (Dunamixfy)</option>
                        <option value="interrapidisimo">Interrápidisimo</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-white/50 text-xs mb-1">SKU Externo *</label>
                      <input type="text" value={newMapping.external_sku}
                        onChange={e => setNewMapping({ ...newMapping, external_sku: e.target.value })}
                        placeholder="Ej: 210"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-white/50 text-xs mb-1">Notas</label>
                      <input type="text" value={newMapping.notes}
                        onChange={e => setNewMapping({ ...newMapping, notes: e.target.value })}
                        placeholder="Opcional"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <button onClick={handleAddMapping}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all text-sm">
                      <Plus className="w-4 h-4" /> Agregar
                    </button>
                  </div>
                </div>

                {isLoadingMappings ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/40 animate-spin" /></div>
                ) : skuMappings.length === 0 ? (
                  <p className="text-center text-white/30 text-sm py-3">No hay SKU externos configurados</p>
                ) : (
                  <div className="space-y-2">
                    {skuMappings.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-white/5 rounded-lg border border-white/10 px-3 py-2">
                        <SourceBadge source={m.source} />
                        <span className="font-mono text-white font-bold text-sm flex-1">{m.external_sku}</span>
                        {m.notes && <span className="text-white/40 text-xs">{m.notes}</span>}
                        <button onClick={() => handleDeleteMapping(m.id)}
                          className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
              <button onClick={closeModal} disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-all text-sm font-medium disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Guardando...' : (editingProduct ? 'Guardar Cambios' : 'Crear Producto')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductManagement;
