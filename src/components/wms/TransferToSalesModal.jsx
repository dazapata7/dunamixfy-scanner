// =====================================================
// TRANSFER TO SALES MODAL - Dunamix WMS
// =====================================================
// Modal reutilizable que dispara el RPC `transfer_production_to_sales`.
// Usado desde:
//   - Producción → Productos (botón por fila)
//   - Producción → Dashboard (card "Listo para liberar a venta")
//
// Props:
//   source        — producto origen (semi/finished_good) con stock_fisico
//   linkedProduct — producto destino (simple/combo), el vinculado
//   warehouseId   — almacén activo
//   operatorId    — (opcional) operador actual para trazabilidad
//   currentStock  — (opcional) override manual del stock disponible
//   onClose       — cerrar el modal
//   onSuccess     — callback después de transferencia exitosa
// =====================================================

import { useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { productionService } from '../../services/wmsService';

const inputCls = "bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-2.5 w-full";

export function TransferToSalesModal({
  source,
  linkedProduct,
  warehouseId,
  operatorId,
  currentStock: currentStockProp,
  onClose,
  onSuccess,
}) {
  const [qty, setQty]     = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy]   = useState(false);

  // Prioridad: currentStock explícito > source.stock_fisico > source.stock_in_warehouse > 0
  const currentStock =
    currentStockProp ??
    source?.stock_fisico ??
    source?.stock_in_warehouse ??
    0;

  const num      = parseFloat(qty) || 0;
  const overflow = num > currentStock;
  const disabled = num <= 0 || overflow || busy;

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
            <p className="text-white font-semibold text-sm">{source?.name}</p>
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
                <span className="truncate">{source?.name}</span>
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

export default TransferToSalesModal;
