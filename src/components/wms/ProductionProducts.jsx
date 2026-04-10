// =====================================================
// PRODUCTION PRODUCTS - Dunamix WMS
// =====================================================
// Gestión de productos de producción: terminados, semiterminados,
// insumos y consumibles. Incluye BOM y categorías.
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsService, skuMappingsService, categoriesService, bomService, inventoryService, productionService } from '../../services/wmsService';
import { useStore } from '../../store/useStore';
import {
  ArrowLeft, Package, Plus, Edit2, Trash2, Save, X,
  Image as ImageIcon, Barcode as BarcodeIcon, Link as LinkIcon,
  Search, RefreshCw, Factory, ArrowRightLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Badge de tipo ──────────────────────────────────
const TYPE_META = {
  finished_good: { label: 'Terminado',   color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80' },
  semi_finished: { label: 'Semitermin.', color: 'bg-purple-500/10 border-purple-500/20 text-purple-400/80' },
  raw_material:  { label: 'Insumo',      color: 'bg-amber-500/10 border-amber-500/20 text-amber-400/80' },
  consumable:    { label: 'Consumible',  color: 'bg-slate-500/10 border-slate-500/20 text-slate-400/80' },
};
// Solo lo que se FABRICA (tienen BOM/fórmula). Los insumos se gestionan en /wms/manage-materials
const PRODUCTION_TYPES = ['finished_good', 'semi_finished'];

const TypeBadge = ({ type }) => {
  const meta = TYPE_META[type] || TYPE_META.raw_material;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${meta.color}`}>{meta.label}</span>;
};

const StatusBadge = ({ active }) => active
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400/80 text-xs font-semibold">Activo</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400/80 text-xs font-semibold">Inactivo</span>;

const ProductThumb = ({ src, name, size = 'md' }) => {
  const [err, setErr] = useState(false);
  const cls = size === 'sm' ? 'w-10 h-10 rounded-lg flex-shrink-0' : 'w-14 h-14 rounded-xl flex-shrink-0';
  if (src && !err) return <img src={src} alt={name} className={`${cls} object-cover border border-white/[0.08]`} onError={() => setErr(true)} />;
  return (
    <div className={`${cls} bg-white/[0.04] border border-white/[0.08] flex items-center justify-center`}>
      <Package className={size === 'sm' ? 'w-4 h-4 text-white/20' : 'w-6 h-6 text-white/20'} />
    </div>
  );
};

const SourceBadge = ({ source }) => {
  if (source === 'dunamixfy') return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400/80 border border-orange-500/20 text-xs font-semibold">Dunamixfy</span>;
  if (source === 'interrapidisimo') return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400/80 border border-blue-500/20 text-xs font-semibold">Interrápidisimo</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] text-white/50 border border-white/[0.08] text-xs font-semibold">{source}</span>;
};

const inputCls = "bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full";

// ─────────────────────────────────────────────────
// Modal: Transferir a venta (manual production → linked simple)
// ─────────────────────────────────────────────────
function TransferToSalesModal({ source, linkedProduct, warehouseId, operatorId, onClose, onSuccess }) {
  const [qty, setQty]     = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy]   = useState(false);

  const currentStock = source.stock_in_warehouse ?? 0;
  const num          = parseFloat(qty) || 0;
  const overflow     = num > currentStock;
  const disabled     = num <= 0 || overflow || busy;

  async function submit() {
    if (disabled) return;
    setBusy(true);
    try {
      const res = await productionService.transferToSales(
        source.id, warehouseId, num, operatorId || null, notes.trim() || null
      );
      if (!res?.success) throw new Error(res?.message || 'Error desconocido');
      toast.success(res.message);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-2xl border border-white/[0.08] w-full max-w-md flex flex-col shadow-2xl">

        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary-400" /> Transferir a venta
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Origen */}
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Desde (producción)</p>
            <p className="text-white font-semibold text-sm">{source.name}</p>
            <p className="text-white/40 text-xs mt-0.5">
              Disponible: <strong className="text-white/80">{currentStock}</strong> unidades
            </p>
          </div>

          <div className="text-center text-primary-400/60 text-xs">↓</div>

          {/* Destino */}
          <div className="bg-primary-500/[0.05] rounded-xl p-3 border border-primary-500/[0.15]">
            <p className="text-primary-400/40 text-[10px] uppercase tracking-widest mb-1">Hacia (venta)</p>
            <p className="text-primary-400 font-semibold text-sm">{linkedProduct?.name || '—'}</p>
            <p className="text-primary-400/40 text-xs mt-0.5">{linkedProduct?.sku}</p>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Cantidad a transferir</label>
            <input type="number" min="0" max={currentStock} step="1"
              value={qty} onChange={e => setQty(e.target.value)}
              autoFocus
              placeholder="0"
              className={`${inputCls} text-center text-lg font-semibold`} />
            {overflow && (
              <p className="text-red-400 text-xs mt-1.5">Excede el stock disponible ({currentStock})</p>
            )}
          </div>

          {/* Notas opcional */}
          <div>
            <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Lote agosto, liberación parcial..."
              rows={2}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 transition-all px-3 py-2.5 w-full resize-none" />
          </div>

          {/* Resumen */}
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.05]">
            <p className="text-white/40 text-xs mb-2">Esta acción creará 2 movimientos en el Kardex:</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2 text-white/60">
                <span className="text-red-400 font-mono">OUT</span>
                <span className="truncate">{source.name}</span>
                <span className="ml-auto text-red-400 font-semibold">-{num || 0}</span>
              </li>
              <li className="flex items-center gap-2 text-white/60">
                <span className="text-emerald-400 font-mono">IN</span>
                <span className="truncate">{linkedProduct?.name}</span>
                <span className="ml-auto text-emerald-400 font-semibold">+{num || 0}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={onClose} disabled={busy}
            className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all text-sm">
            Cancelar
          </button>
          <button onClick={submit} disabled={disabled}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {busy
              ? <><div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> Transfiriendo...</>
              : <><ArrowRightLeft className="w-4 h-4" /> Transferir {num || 0}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
export function ProductionProducts() {
  const navigate = useNavigate();
  const companyId = useStore(s => s.companyId);
  const selectedWarehouse = useStore(s => s.selectedWarehouse);
  const operator = useStore(s => s.operator);

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Transfer modal state
  const [transferProduct, setTransferProduct] = useState(null);

  const [formData, setFormData] = useState({
    sku: '', name: '', barcode: '', photo_url: '',
    description: '', is_active: true, type: 'raw_material', category_id: '',
    linked_product_id: '', unit: 'unidades',
  });

  // SKU Mappings
  const [skuMappings, setSkuMappings] = useState([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [newMapping, setNewMapping] = useState({ source: 'dunamixfy', external_sku: '', notes: '' });

  // BOM
  const [bomItems, setBomItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [simpleProducts, setSimpleProducts] = useState([]);

  useEffect(() => { loadProducts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedWarehouse?.id]);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const [data, stockRows] = await Promise.all([
        productsService.getAll(),
        selectedWarehouse?.id
          ? inventoryService.getAllStock(selectedWarehouse.id)
          : Promise.resolve([]),
      ]);
      const stockMap = Object.fromEntries(
        (stockRows || []).map(r => [r.product_id, Number(r.qty_on_hand) || 0])
      );
      const enriched = data.map(p => ({
        ...p,
        stock_in_warehouse: stockMap[p.id] ?? 0,
        linked_name: p.linked_product_id
          ? data.find(x => x.id === p.linked_product_id)?.name || null
          : null,
      }));
      setProducts(enriched.filter(p => PRODUCTION_TYPES.includes(p.type)));
      setSimpleProducts(enriched.filter(p => ['simple', 'combo'].includes(p.type)));
    } catch { toast.error('Error al cargar productos de producción'); }
    finally { setIsLoading(false); }
  }

  async function openCreate() {
    setEditingProduct(null);
    setFormData({ sku: '', name: '', barcode: '', photo_url: '', description: '', is_active: true, type: 'raw_material', category_id: '', linked_product_id: '', unit: 'unidades' });
    setSkuMappings([]);
    setBomItems([]);
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
    try {
      const [all, cats] = await Promise.all([productsService.getAll(), categoriesService.getAll()]);
      setAvailableProducts(all);
      setSimpleProducts(all.filter(p => ['simple', 'combo'].includes(p.type)));
      setCategories(cats);
    } catch { /* ignore */ }
    setShowModal(true);
  }

  async function openEdit(product) {
    setEditingProduct(product);
    setFormData({
      sku: product.sku, name: product.name, barcode: product.barcode || '',
      photo_url: product.photo_url || '', description: product.description || '',
      is_active: product.is_active, type: product.type || 'raw_material',
      category_id: product.category_id || '', linked_product_id: product.linked_product_id || '',
      unit: product.unit || 'unidades',
    });
    setNewMapping({ source: 'dunamixfy', external_sku: '', notes: '' });
    setBomItems([]);

    setIsLoadingMappings(true);
    try {
      const [mappings, allProds, cats] = await Promise.all([
        skuMappingsService.getByProductId(product.id),
        productsService.getAll(),
        categoriesService.getAll(),
      ]);
      setSkuMappings(mappings);
      setAvailableProducts(allProds.filter(p => p.id !== product.id));
      setSimpleProducts(allProds.filter(p => ['simple', 'combo'].includes(p.type)));
      setCategories(cats);

      if (['finished_good', 'semi_finished'].includes(product.type)) {
        const bom = await bomService.getByProduct(product.id);
        if (bom?.items) {
          setBomItems(bom.items.map(i => ({
            component_product_id: i.component_product_id,
            product_name: i.component?.name || '',
            product_sku: i.component?.sku || '',
            qty_required: i.qty_required,
            unit_of_measure: i.unit_of_measure || 'unidad',
            waste_factor: i.waste_factor || 1,
            notes: i.notes || '',
          })));
        }
      }
    } catch { toast.error('Error al cargar datos del producto'); }
    finally { setIsLoadingMappings(false); }
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditingProduct(null); }

  async function handleSave() {
    if (!formData.sku || !formData.name) { toast.error('SKU y nombre son requeridos'); return; }
    if (['finished_good', 'semi_finished'].includes(formData.type) && bomItems.some(b => !b.component_product_id)) {
      toast.error('Todos los componentes del BOM deben tener un producto seleccionado'); return;
    }

    setIsSaving(true);
    try {
      let productId = editingProduct?.id;
      const isCreating = !productId;
      const payload = {
        ...formData,
        category_id: formData.category_id || null,
        linked_product_id: ['finished_good', 'semi_finished'].includes(formData.type)
          ? (formData.linked_product_id || null)
          : null,
      };

      if (isCreating) {
        const newProd = await productsService.create({ ...payload, company_id: companyId });
        productId = newProd.id;
      } else {
        await productsService.update(productId, payload);
      }

      if (['finished_good', 'semi_finished'].includes(formData.type)) {
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
    } finally { setIsSaving(false); }
  }

  async function handleDelete(product) {
    if (!confirm(`¿Eliminar "${product.name}"?\n\nSolo se puede eliminar si no tiene movimientos de inventario.`)) return;
    try {
      await productsService.delete(product.id);
      toast.success('Producto eliminado');
      loadProducts();
    } catch (error) { toast.error(error.message || 'Error al eliminar'); }
  }

  // SKU Mapping handlers
  async function handleAddMapping() {
    if (!newMapping.external_sku.trim()) { toast.error('El SKU externo es requerido'); return; }
    if (!editingProduct) {
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
    if (!editingProduct) { setSkuMappings(skuMappings.filter(m => m.id !== mappingId)); return; }
    try {
      await skuMappingsService.delete(mappingId);
      const mappings = await skuMappingsService.getByProductId(editingProduct.id);
      setSkuMappings(mappings);
    } catch (error) { toast.error(error.message || 'Error al eliminar'); }
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
    const updated = [...bomItems];
    updated[i] = {
      ...updated[i],
      component_product_id: productId,
      ...(prod ? {
        product_name: prod.name,
        product_sku: prod.sku,
        unit_of_measure: prod.unit || 'unidades',
      } : {}),
    };
    setBomItems(updated);
  }

  // Filter & group
  const filtered = products.filter(p => {
    const q = searchTerm.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
  });

  const finished = filtered.filter(p => p.type === 'finished_good');
  const semiFin  = filtered.filter(p => p.type === 'semi_finished');

  const showBom = ['finished_good', 'semi_finished'].includes(formData.type);

  const canTransfer = (p) =>
    ['finished_good', 'semi_finished'].includes(p.type)
    && p.linked_product_id
    && (p.stock_in_warehouse ?? 0) > 0;

  const LinkedBadge = ({ name }) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400/80 text-xs font-semibold">
      <LinkIcon className="w-3 h-3" /> {name}
    </span>
  );

  const ProductRow = ({ product }) => (
    <tr className="hover:bg-primary-500/[0.03] transition-colors group">
      <td className="px-4 py-3"><ProductThumb src={product.photo_url} name={product.name} size="sm" /></td>
      <td className="px-4 py-3">
        <p className="text-white font-medium text-sm truncate max-w-[220px]">{product.name}</p>
        <p className="text-white/40 text-xs font-mono">{product.sku}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={product.type} />
          {product.linked_name && <LinkedBadge name={product.linked_name} />}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-white/40 text-xs">{product.barcode || '—'}</td>
      <td className="px-4 py-3">
        <span className="text-white/70 text-sm font-semibold">{product.stock_in_warehouse ?? 0}</span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs font-mono">{product.unit || 'uds'}</span>
      </td>
      <td className="px-4 py-3"><StatusBadge active={product.is_active} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {canTransfer(product) && (
            <button onClick={() => setTransferProduct(product)}
              className="p-2 rounded-lg bg-primary-500/[0.08] border border-primary-500/20 text-primary-400 hover:bg-primary-500/[0.15] transition-all"
              title="Transferir a venta">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => openEdit(product)} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleDelete(product)} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] transition-all" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
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
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <TypeBadge type={product.type} />
          {product.linked_name && <LinkedBadge name={product.linked_name} />}
          <span className="text-white/40 text-xs ml-1">Stock: <strong className="text-white/70">{product.stock_in_warehouse ?? 0}</strong></span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 text-[10px] font-mono">{product.unit || 'uds'}</span>
          <div className="flex-1" />
          {canTransfer(product) && (
            <button onClick={() => setTransferProduct(product)}
              className="p-2 rounded-lg bg-primary-500/[0.08] border border-primary-500/20 text-primary-400 hover:bg-primary-500/[0.15] transition-all"
              title="Transferir a venta">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => openEdit(product)} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleDelete(product)} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );

  const TableSection = ({ title, items, color }) => (
    items.length === 0 ? null : (
      <>
        <tr><td colSpan={8} className="px-4 pt-5 pb-2"><p className={`text-[10px] font-semibold uppercase tracking-widest ${color}`}>{title} ({items.length})</p></td></tr>
        {items.map(p => <ProductRow key={p.id} product={p} />)}
      </>
    )
  );

  return (
    <div className="min-h-screen bg-dark-950 p-4 lg:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">

        <button onClick={() => navigate('/wms/production')}
          className="lg:hidden bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Barra superior */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <Factory className="w-5 h-5 text-amber-400" />
            <span className="text-white font-bold text-sm hidden sm:block">Productos de Producción</span>
          </div>
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
            <Plus className="w-4 h-4" /> Nuevo
          </button>
          <div className="w-full mt-1 text-white/30 text-xs">
            {filtered.length} de {products.length} productos
            {searchTerm && <span className="ml-1.5 text-primary-400/70">· búsqueda activa</span>}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/10 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}

        {/* DESKTOP: tabla */}
        {!isLoading && (
          <div className="hidden lg:block bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm mb-4">{searchTerm ? 'No hay productos con esa búsqueda' : 'No hay productos de producción'}</p>
                {!searchTerm && (
                  <button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-amber-500/30 text-sm">
                    Crear primer producto
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-black/20">
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-16">Foto</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Producto</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em]">Tipo</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-32">Cód. de Barras</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-20">Stock</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-20">Unidad</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-24">Estado</th>
                    <th className="px-4 py-3 text-left text-white/25 font-medium text-[11px] uppercase tracking-[0.12em] w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  <TableSection title="Productos Terminados" items={finished} color="text-emerald-400/60" />
                  <TableSection title="Semiterminados"        items={semiFin}  color="text-purple-400/60" />
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
                  <p className="text-white/30 text-sm">No hay productos de producción</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">{filtered.map(p => <ProductCard key={p.id} product={p} />)}</div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODAL - Crear / Editar Producto de Producción
      ══════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-2xl border border-white/[0.08] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

            <div className="flex items-center justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
              <h2 className="text-white font-semibold text-base">
                {editingProduct ? `Editar: ${editingProduct.sku}` : 'Nuevo Producto de Producción'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* ── Campos del producto ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">SKU *</label>
                  <input type="text" value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="INS-001" disabled={!!editingProduct}
                    className={`${inputCls} disabled:opacity-50`} />
                </div>
                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Nombre *</label>
                  <input type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre del producto" className={inputCls} />
                </div>
                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Tipo</label>
                  <select value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    style={{ colorScheme: 'dark' }} className={inputCls}>
                    <option value="finished_good">Producto Terminado</option>
                    <option value="semi_finished">Semiterminado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Categoría</label>
                  <select value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    style={{ colorScheme: 'dark' }} className={inputCls}>
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

                {/* Unidad base */}
                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Unidad base</label>
                  <select value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    style={{ colorScheme: 'dark' }} className={inputCls}>
                    {['unidades','unidad','ml','mg','g','kg','L','m','cm','par','rollo'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <p className="text-white/15 text-xs mt-1">Usada para auto-rellenar la unidad en el BOM cuando este insumo es seleccionado como componente.</p>
                </div>

                {/* Vinculación a producto simple */}
                {['finished_good', 'semi_finished'].includes(formData.type) && (
                  <div className="md:col-span-2">
                    <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">
                      Vincular a Producto (módulo Productos)
                    </label>
                    <select value={formData.linked_product_id}
                      onChange={e => setFormData({ ...formData, linked_product_id: e.target.value })}
                      style={{ colorScheme: 'dark' }} className={inputCls}>
                      <option value="">Sin vincular</option>
                      {simpleProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    <p className="text-white/20 text-xs mt-1">Habilita el botón <em>Transferir a venta</em> en la lista para mover stock a este producto manualmente.</p>
                  </div>
                )}

                <div>
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Código de Barras</label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                    <input type="text" value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="7891234567890" className={`${inputCls} pl-9`} />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">URL de Foto</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <input type="text" value={formData.photo_url}
                        onChange={e => setFormData({ ...formData, photo_url: e.target.value })}
                        placeholder="https://ejemplo.com/foto.jpg" className={`${inputCls} pl-9`} />
                    </div>
                    {formData.photo_url && <ProductThumb src={formData.photo_url} name={formData.name} size="md" />}
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
                  <input type="checkbox" id="pp_is_active" checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/[0.04] border-white/[0.08] text-primary-500 focus:ring-2 focus:ring-primary-500/30" />
                  <label htmlFor="pp_is_active" className="text-white/60 text-sm">Producto activo</label>
                </div>
              </div>

              {/* ── BOM / Fórmula de Fabricación ── */}
              {showBom && (
                <div className="border-t border-white/[0.06] pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold text-sm">Fórmula de Fabricación (BOM)</h3>
                      <p className="text-white/40 text-xs mt-0.5">Insumos necesarios para fabricar 1 unidad</p>
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
                      <div className="hidden md:grid grid-cols-[1fr_80px_90px_80px_32px] gap-2 px-1">
                        {['Insumo / Componente','Cantidad','Unidad','% Merma',''].map(h => (
                          <span key={h} className="text-white/25 text-[10px] uppercase tracking-widest">{h}</span>
                        ))}
                      </div>
                      {bomItems.map((b, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_80px_90px_80px_32px] gap-2 items-center bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
                          <select value={b.component_product_id} onChange={e => selectBomProduct(i, e.target.value)}
                            style={{ colorScheme: 'dark' }} className={inputCls}>
                            <option value="">Selecciona insumo...</option>
                            {availableProducts.filter(p => ['raw_material', 'consumable', 'semi_finished'].includes(p.type)).map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                          <input type="number" min="0.0001" step="0.01" value={b.qty_required}
                            onChange={e => updateBomItem(i, 'qty_required', parseFloat(e.target.value) || 1)}
                            className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all px-3 py-2.5 w-full text-center" />
                          <select value={b.unit_of_measure}
                            onChange={e => updateBomItem(i, 'unit_of_measure', e.target.value)}
                            style={{ colorScheme: 'dark' }}
                            className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all px-3 py-2.5 w-full">
                            {['unidades','unidad','ml','mg','g','kg','L','m','cm','par','rollo'].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                          <input type="number" min="1" max="2" step="0.01" value={b.waste_factor}
                            onChange={e => updateBomItem(i, 'waste_factor', parseFloat(e.target.value) || 1)}
                            className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 focus:outline-none focus:border-amber-500/40 transition-all px-3 py-2.5 w-full text-center" />
                          <button onClick={() => removeBomItem(i)}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-all flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <p className="text-white/20 text-xs px-1">Merma: 1.00 = sin merma · 1.05 = 5% · 1.10 = 10%</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SKU Externos ── */}
              <div className="border-t border-white/[0.06] pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <LinkIcon className="w-4 h-4 text-primary-400" />
                  <h3 className="text-white font-semibold text-sm">SKU Externos</h3>
                </div>
                <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 mb-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="min-w-[160px]">
                      <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Fuente</label>
                      <select value={newMapping.source}
                        onChange={e => setNewMapping({ ...newMapping, source: e.target.value })}
                        style={{ colorScheme: 'dark' }} className={inputCls}>
                        <option value="dunamixfy">Coordinadora (Dunamixfy)</option>
                        <option value="interrapidisimo">Interrápidisimo</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">SKU Externo *</label>
                      <input type="text" value={newMapping.external_sku}
                        onChange={e => setNewMapping({ ...newMapping, external_sku: e.target.value })}
                        placeholder="Ej: 210" className={inputCls} />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Notas</label>
                      <input type="text" value={newMapping.notes}
                        onChange={e => setNewMapping({ ...newMapping, notes: e.target.value })}
                        placeholder="Opcional" className={inputCls} />
                    </div>
                    <button onClick={handleAddMapping}
                      className="bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm">
                      <Plus className="w-4 h-4" /> Agregar
                    </button>
                  </div>
                </div>
                {isLoadingMappings ? (
                  <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" /></div>
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
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-dark-950 font-semibold px-4 py-2 rounded-lg transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                {isSaving
                  ? <><div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4" /> {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL - Transferir a venta
      ══════════════════════════════════════════════ */}
      {transferProduct && (
        <TransferToSalesModal
          source={transferProduct}
          linkedProduct={simpleProducts.find(p => p.id === transferProduct.linked_product_id)
            || products.find(p => p.id === transferProduct.linked_product_id)
            || { name: transferProduct.linked_name, sku: '' }}
          warehouseId={selectedWarehouse?.id}
          operatorId={operator?.id}
          onClose={() => setTransferProduct(null)}
          onSuccess={() => loadProducts()}
        />
      )}
    </div>
  );
}

export default ProductionProducts;
