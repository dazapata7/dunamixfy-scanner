// =====================================================
// RAW MATERIALS MANAGEMENT - Dunamix WMS
// =====================================================
// Gestión de insumos: etiquetas, cajas, envases, consumibles
// Desktop: lista tipo tabla + modal para crear/editar
// Móvil: cards compactas
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsService, skuMappingsService, comboProductsService, categoriesService, bomService } from '../../services/wmsService';
import useStore from '../../store/useStore';
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
const TYPE_META = {
  simple:       { label: 'Simple',      color: 'bg-primary-500/10 border-primary-500/20 text-primary-400/80' },
  combo:        { label: 'Combo',       color: 'bg-blue-500/10 border-blue-500/20 text-blue-400/80' },
  raw_material: { label: 'Insumo',      color: 'bg-amber-500/10 border-amber-500/20 text-amber-400/80' },
  finished_good:{ label: 'Terminado',   color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80' },
  semi_finished:{ label: 'Semitermin.', color: 'bg-purple-500/10 border-purple-500/20 text-purple-400/80' },
  consumable:   { label: 'Consumible',  color: 'bg-slate-500/10 border-slate-500/20 text-slate-400/80' },
};
const TypeBadge = ({ type }) => {
  const meta = TYPE_META[type] || TYPE_META.simple;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${meta.color}`}>{meta.label}</span>;
};

// ── Badge de estado ────────────────────────────────
const StatusBadge = ({ active }) => active
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400/80 text-xs font-semibold">Activo</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400/80 text-xs font-semibold">Inactivo</span>;

// ── Thumbnail de producto ──────────────────────────
const ProductThumb = ({ src, name, size = 'md' }) => {
  const [err, setErr] = useState(false);
  const cls = size === 'sm'
    ? 'w-10 h-10 rounded-lg flex-shrink-0'
    : 'w-14 h-14 rounded-xl flex-shrink-0';
  if (src && !err) {
    return <img src={src} alt={name} className={`${cls} object-cover border border-white/[0.08]`} onError={() => setErr(true)} />;
  }
  return (
    <div className={`${cls} bg-white/[0.04] border border-white/[0.08] flex items-center justify-center`}>
      <Package className={size === 'sm' ? 'w-4 h-4 text-white/20' : 'w-6 h-6 text-white/20'} />
    </div>
  );
};

// ── Source Badge ───────────────────────────────────
const SourceBadge = ({ source }) => {
  if (source === 'dunamixfy') return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400/80 border border-orange-500/20 text-xs font-semibold">Dunamixfy</span>;
  if (source === 'interrapidisimo') return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400/80 border border-blue-500/20 text-xs font-semibold">Interrápidisimo</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] text-white/50 border border-white/[0.08] text-xs font-semibold">{source}</span>;
};

const inputCls = "bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full";

// ─────────────────────────────────────────────────
export function RawMaterialsManagement() {
  const navigate = useNavigate();
  const companyId = useStore(s => s.companyId);

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    sku: '', name: '', barcode: '', photo_url: '',
    description: '', is_active: true, type: 'raw_material'
  });

  // SKU Mappings
  const [skuMappings, setSkuMappings] = useState([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [newMapping, setNewMapping] = useState({ source: 'dunamixfy', external_sku: '', notes: '' });

  // Combo components (legacy)
  const [comboComponents, setComboComponents] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // BOM (nuevo)
  const [bomItems, setBomItems] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const data = await productsService.getAll();
      // Filtrar solo insumos: raw_material, consumable, semi_finished
      const materials = data.filter(p => ['raw_material', 'consumable', 'semi_finished'].includes(p.type));
      setProducts(materials);
    } catch { toast.error('Error al cargar insumos'); }
    finally { setIsLoading(false); }
  }

  async function openCreate() {
    setEditingProduct(null);
    setFormData({ sku: '', name: '', barcode: '', photo_url: '', description: '', is_active: true, type: 'raw_material', category_id: '' });
    setSkuMappings([]);
    setComboComponents([]);
    setBomItems([]);
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
    try {
      const [all, cats] = await Promise.all([
        productsService.getAll(),
        categoriesService.getAll(),
      ]);
      setAvailableProducts(all);
      setCategories(cats);
    } catch { /* ignore */ }
    setShowModal(true);
  }

  async function openEdit(product) {
    setEditingProduct(product);
    setFormData({
      sku:         product.sku,
      name:        product.name,
      barcode:     product.barcode     || '',
      photo_url:   product.photo_url   || '',
      description: product.description || '',
      is_active:   product.is_active,
      type:        product.type        || 'simple',
      category_id: product.category_id || '',
    });
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
    setBomItems([]);
    setComboComponents([]);

    setIsLoadingMappings(true);
    try {
      const [mappings, allProds, cats] = await Promise.all([
        skuMappingsService.getByProductId(product.id),
        productsService.getAll(),
        categoriesService.getAll(),
      ]);
      setSkuMappings(mappings);
      setAvailableProducts(allProds.filter(p => p.id !== product.id));
      setCategories(cats);

      const bomTypes = ['finished_good', 'semi_finished', 'combo'];
      if (bomTypes.includes(product.type)) {
        const bom = await bomService.getByProduct(product.id);
        if (bom?.items) {
          setBomItems(bom.items.map(i => ({
            component_product_id: i.component_product_id,
            product_name:         i.component?.name || '',
            product_sku:          i.component?.sku  || '',
            qty_required:         i.qty_required,
            unit_of_measure:      i.unit_of_measure || 'unidad',
            waste_factor:         i.waste_factor    || 1,
            notes:                i.notes           || '',
          })));
        }
      } else if (product.type === 'combo') {
        const components = await comboProductsService.getComponents(product.id);
        setComboComponents(components.map(c => ({
          id: c.id, product_id: c.component.id,
          product_name: c.component.name, quantity: c.quantity
        })));
      }
    } catch { toast.error('Error al cargar datos del producto'); }
    finally { setIsLoadingMappings(false); }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProduct(null);
  }

  async function handleSave() {
    if (!formData.sku || !formData.name) { toast.error('SKU y nombre son requeridos'); return; }
    const bomTypes = ['finished_good', 'semi_finished', 'combo'];
    if (bomTypes.includes(formData.type) && bomItems.some(b => !b.component_product_id)) {
      toast.error('Todos los componentes del BOM deben tener un producto seleccionado'); return;
    }

    setIsSaving(true);
    try {
      let productId = editingProduct?.id;
      const isCreating = !productId;

      const payload = { ...formData, category_id: formData.category_id || null };

      if (isCreating) {
        const newProd = await productsService.create({ ...payload, company_id: companyId });
        productId = newProd.id;
      } else {
        await productsService.update(productId, payload);
      }

      // Guardar BOM si aplica
      if (bomTypes.includes(formData.type)) {
        await bomService.save(productId, bomItems);
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

  function addComponent() { setComboComponents([...comboComponents, { product_id: '', quantity: 1 }]); }
  function removeComponent(i) { setComboComponents(comboComponents.filter((_, idx) => idx !== i)); }
  function updateComponent(i, field, value) {
    const updated = [...comboComponents];
    updated[i][field] = value;
    setComboComponents(updated);
  }

  // BOM helpers
  function addBomItem() {
    setBomItems([...bomItems, { component_product_id: '', product_name: '', qty_required: 1, unit_of_measure: 'unidad', waste_factor: 1, notes: '' }]);
  }
  function removeBomItem(i) { setBomItems(bomItems.filter((_, idx) => idx !== i)); }
  function updateBomItem(i, field, value) {
    const updated = [...bomItems];
    updated[i] = { ...updated[i], [field]: value };
    setBomItems(updated);
  }
  function selectBomProduct(i, productId) {
    const prod = availableProducts.find(p => p.id === productId);
    updateBomItem(i, 'component_product_id', productId);
    if (prod) {
      updateBomItem(i, 'product_name', prod.name);
      updateBomItem(i, 'product_sku', prod.sku);
    }
  }

  const filtered = products.filter(p => {
    const q = searchTerm.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
  });

  const finished   = filtered.filter(p => p.type === 'finished_good');
  const rawMat     = filtered.filter(p => p.type === 'raw_material');
  const consumable = filtered.filter(p => p.type === 'consumable');
  const semiFin    = filtered.filter(p => p.type === 'semi_finished');
  const simples    = filtered.filter(p => !p.type || p.type === 'simple');
  const combos     = filtered.filter(p => p.type === 'combo');

  const ProductRow = ({ product }) => (
    <tr className="hover:bg-primary-500/[0.03] transition-colors group">
      <td className="px-4 py-3">
        <ProductThumb src={product.photo_url} name={product.name} size="sm" />
      </td>
      <td className="px-4 py-3">
        <p className="text-white font-medium text-sm truncate max-w-[220px]">{product.name}</p>
        <p className="text-white/40 text-xs font-mono">{product.sku}</p>
      </td>
      <td className="px-4 py-3"><TypeBadge type={product.type} /></td>
      <td className="px-4 py-3 font-mono text-white/40 text-xs">{product.barcode || '—'}</td>
      <td className="px-4 py-3"><StatusBadge active={product.is_active} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => openEdit(product)}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all" title="Editar">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDelete(product)}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] transition-all" title="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );

  const ProductCard = ({ product }) => (
    <div className="bg-dark-800 rounded-2xl border border-white/[0.08] p-3 flex gap-3">
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
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDelete(product)}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

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
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* Volver – solo móvil */}
        <button onClick={() => navigate('/wms')}
          className="lg:hidden bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Barra superior */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
            <input type="text" placeholder="Buscar por nombre, SKU, código de barras..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-9`} />
          </div>

          <button onClick={loadProducts} disabled={isLoading}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nuevo Insumo
          </button>

          <div className="w-full mt-1 text-white/30 text-xs">
            {filtered.length} de {products.length} insumos
            {searchTerm && <span className="ml-1.5 text-amber-400/70">· búsqueda activa</span>}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
          </div>
        )}

        {/* DESKTOP: tabla */}
        {!isLoading && (
          <div className="hidden lg:block bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm mb-4">
                  {searchTerm ? 'No hay insumos con esa búsqueda' : 'No hay insumos creados'}
                </p>
                {!searchTerm && (
                  <button onClick={openCreate}
                    className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-amber-500/30 text-sm">
                    Crear primer insumo
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-black/20">
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-16">Foto</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Producto</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Tipo</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-36">Cód. de Barras</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Estado</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  <TableSection title="Productos Terminados" items={finished}   color="text-emerald-400/60" />
                  <TableSection title="Insumos de Fabricación" items={rawMat}   color="text-amber-400/60" />
                  <TableSection title="Consumibles"           items={consumable} color="text-slate-400/60" />
                  <TableSection title="Semiterminados"        items={semiFin}    color="text-purple-400/60" />
                  <TableSection title="Simples (legacy)"      items={simples}    color="text-primary-400/60" />
                  <TableSection title="Combos (legacy)"       items={combos}     color="text-blue-400/60" />
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MÓVIL: cards */}
        {!isLoading && (
          <div className="lg:hidden space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08]">
                <div className="py-16 text-center">
                  <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No hay productos</p>
                </div>
              </div>
            ) : (
              <>
                {simples.length > 0 && (
                  <div>
                    <p className="text-white/25 text-[11px] uppercase tracking-[0.12em] mb-2 px-1">Productos ({simples.length})</p>
                    <div className="space-y-2">{simples.map(p => <ProductCard key={p.id} product={p} />)}</div>
                  </div>
                )}
                {combos.length > 0 && (
                  <div>
                    <p className="text-white/25 text-[11px] uppercase tracking-[0.12em] mb-2 px-1">Combos ({combos.length})</p>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-2xl border border-white/[0.08] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
              <h2 className="text-white font-semibold text-base">
                {editingProduct ? `Editar: ${editingProduct.sku}` : 'Nuevo Producto'}
              </h2>
              <button onClick={closeModal}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body – scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* ── Campos del producto ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">SKU *</label>
                  <input type="text" value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="PROD-001" disabled={!!editingProduct}
                    className={`${inputCls} disabled:opacity-50`} />
                </div>

                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Nombre *</label>
                  <input type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre del producto"
                    className={inputCls} />
                </div>

                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Tipo</label>
                  <select value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                    className={inputCls}>
                    <optgroup label="Producción">
                      <option value="finished_good">✅ Producto Terminado</option>
                      <option value="raw_material">🧪 Insumo de Fabricación</option>
                      <option value="semi_finished">⚙️ Semiterminado</option>
                      <option value="consumable">🔧 Consumible Interno</option>
                    </optgroup>
                    <optgroup label="Legacy">
                      <option value="simple">Simple</option>
                      <option value="combo">Combo</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Categoría</label>
                  <select value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                    className={inputCls}>
                    <option value="">Sin categoría</option>
                    {categories.filter(c => !c.parent_id).map(cat => (
                      <optgroup key={cat.id} label={`${cat.icon || ''} ${cat.name}`}>
                        <option value={cat.id}>{cat.icon} {cat.name}</option>
                        {categories.filter(c => c.parent_id === cat.id).map(sub => (
                          <option key={sub.id} value={sub.id}>  └ {sub.icon} {sub.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Código de Barras</label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                    <input type="text" value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="7891234567890"
                      className={`${inputCls} pl-9`} />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">URL de Foto</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <input type="text" value={formData.photo_url}
                        onChange={e => setFormData({ ...formData, photo_url: e.target.value })}
                        placeholder="https://ejemplo.com/foto.jpg"
                        className={`${inputCls} pl-9`} />
                    </div>
                    {formData.photo_url && (
                      <ProductThumb src={formData.photo_url} name={formData.name} size="md" />
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Descripción</label>
                  <textarea value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del producto" rows={2}
                    className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full resize-none" />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/[0.04] border-white/[0.08] text-primary-500 focus:ring-2 focus:ring-primary-500/30" />
                  <label htmlFor="is_active" className="text-white/60 text-sm">Producto activo</label>
                </div>
              </div>

              {/* ── Componentes del Combo ── */}
              {formData.type === 'combo' && (
                <div className="border-t border-white/[0.06] pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-sm">Componentes del Combo</h3>
                      <p className="text-white/40 text-xs mt-0.5">Productos que forman este combo</p>
                    </div>
                    <button onClick={addComponent}
                      className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs">
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
                            className={`${inputCls} flex-1`}>
                            <option value="">Selecciona un producto...</option>
                            {availableProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                          <input type="number" min="1" value={c.quantity}
                            onChange={e => updateComponent(i, 'quantity', parseInt(e.target.value) || 1)}
                            className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-20 text-center" />
                          <button onClick={() => removeComponent(i)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── BOM / Fórmula de Fabricación ── */}
              {['finished_good', 'semi_finished', 'combo'].includes(formData.type) && (
                <div className="border-t border-white/[0.06] pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                        🧪 Fórmula de Fabricación (BOM)
                      </h3>
                      <p className="text-white/40 text-xs mt-0.5">Insumos necesarios para fabricar 1 unidad de este producto</p>
                    </div>
                    <button onClick={addBomItem}
                      className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold">
                      <Plus className="w-3.5 h-3.5" /> Agregar insumo
                    </button>
                  </div>

                  {bomItems.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/[0.08] rounded-xl">
                      <p className="text-white/25 text-sm">Sin insumos definidos</p>
                      <p className="text-white/15 text-xs mt-1">Agrega los materiales necesarios para fabricar este producto</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="hidden md:grid grid-cols-[1fr_80px_90px_80px_32px] gap-2 px-1">
                        {['Insumo / Componente','Cantidad','Unidad','% Merma',''].map(h => (
                          <span key={h} className="text-white/25 text-[10px] uppercase tracking-widest">{h}</span>
                        ))}
                      </div>
                      {bomItems.map((b, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_80px_90px_80px_32px] gap-2 items-center bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
                          <select
                            value={b.component_product_id}
                            onChange={e => selectBomProduct(i, e.target.value)}
                            style={{ colorScheme: 'dark' }}
                            className={inputCls}>
                            <option value="">Selecciona insumo...</option>
                            {availableProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                          <input type="number" min="0.0001" step="0.01"
                            value={b.qty_required}
                            onChange={e => updateBomItem(i, 'qty_required', parseFloat(e.target.value) || 1)}
                            className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all px-3 py-2.5 w-full text-center" />
                          <input type="text"
                            value={b.unit_of_measure}
                            onChange={e => updateBomItem(i, 'unit_of_measure', e.target.value)}
                            placeholder="unidad"
                            className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all px-3 py-2.5 w-full" />
                          <div className="relative">
                            <input type="number" min="1" max="2" step="0.01"
                              value={b.waste_factor}
                              onChange={e => updateBomItem(i, 'waste_factor', parseFloat(e.target.value) || 1)}
                              className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all px-3 py-2.5 w-full text-center" />
                          </div>
                          <button onClick={() => removeBomItem(i)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-all flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <p className="text-white/20 text-xs px-1">
                        Merma: 1.00 = sin merma · 1.05 = 5% merma · 1.10 = 10% merma
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SKU Externos ── */}
              <div className="border-t border-white/[0.06] pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <LinkIcon className="w-4 h-4 text-primary-400" />
                  <h3 className="text-white font-semibold text-sm">SKU Externos</h3>
                  <span className="text-white/30 text-xs">Mapeo de Dunamixfy e Interrápidisimo</span>
                </div>

                {/* Agregar mapping */}
                <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 mb-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="min-w-[160px]">
                      <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Fuente</label>
                      <select value={newMapping.source}
                        onChange={e => setNewMapping({ ...newMapping, source: e.target.value })}
                        style={{ colorScheme: 'dark' }}
                        className={inputCls}>
                        <option value="dunamixfy">Coordinadora (Dunamixfy)</option>
                        <option value="interrapidisimo">Interrápidisimo</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">SKU Externo *</label>
                      <input type="text" value={newMapping.external_sku}
                        onChange={e => setNewMapping({ ...newMapping, external_sku: e.target.value })}
                        placeholder="Ej: 210"
                        className={inputCls} />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Notas</label>
                      <input type="text" value={newMapping.notes}
                        onChange={e => setNewMapping({ ...newMapping, notes: e.target.value })}
                        placeholder="Opcional"
                        className={inputCls} />
                    </div>
                    <button onClick={handleAddMapping}
                      className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm">
                      <Plus className="w-4 h-4" /> Agregar
                    </button>
                  </div>
                </div>

                {isLoadingMappings ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
                  </div>
                ) : skuMappings.length === 0 ? (
                  <p className="text-center text-white/30 text-sm py-3">No hay SKU externos configurados</p>
                ) : (
                  <div className="space-y-2">
                    {skuMappings.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-white/[0.04] rounded-xl border border-white/[0.08] px-3 py-2">
                        <SourceBadge source={m.source} />
                        <span className="font-mono text-white font-bold text-sm flex-1">{m.external_sku}</span>
                        {m.notes && <span className="text-white/40 text-xs">{m.notes}</span>}
                        <button onClick={() => handleDeleteMapping(m.id)}
                          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 p-5 border-t border-white/[0.06] flex-shrink-0">
              <button onClick={closeModal} disabled={isSaving}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                {isSaving
                  ? <><div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4" /> {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RawMaterialsManagement;
