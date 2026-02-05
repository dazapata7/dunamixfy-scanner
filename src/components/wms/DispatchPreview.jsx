// =====================================================
// DISPATCH PREVIEW - Dunamix WMS
// =====================================================
// Preview de despacho antes de confirmar
// Muestra items, stock disponible, validaciones
// =====================================================

import { Check, X, AlertTriangle, Package, TrendingDown } from 'lucide-react';

export function DispatchPreview({ dispatch, stockValidation, onConfirm, onCancel, isProcessing }) {

  // Verificar si hay items con stock insuficiente
  const hasInsufficientStock = stockValidation && !stockValidation.valid;
  const insufficientItems = hasInsufficientStock
    ? stockValidation.results.filter(r => r.insufficient)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`
              p-4 rounded-2xl
              ${hasInsufficientStock ? 'bg-orange-500/20' : 'bg-green-500/20'}
            `}>
              <Package className={`
                w-8 h-8
                ${hasInsufficientStock ? 'text-orange-400' : 'text-green-400'}
              `} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Revisar Despacho
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {dispatch.dispatch_number}
              </p>
            </div>
          </div>

          {/* Guide Code */}
          {dispatch.guide_code && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/60 text-xs mb-1">Guía de Envío</p>
              <p className="text-white font-mono text-lg">
                {dispatch.guide_code}
              </p>
            </div>
          )}
        </div>

        {/* Stock Warning */}
        {hasInsufficientStock && (
          <div className="bg-orange-500/10 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-6 shadow-glass-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-orange-300 font-bold mb-2">
                  ⚠️ Stock Insuficiente
                </h3>
                <p className="text-orange-200/80 text-sm mb-3">
                  Algunos productos no tienen stock suficiente para completar este despacho:
                </p>
                <ul className="space-y-2">
                  {insufficientItems.map((item, index) => (
                    <li key={index} className="text-orange-200/90 text-sm flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      <span className="font-mono">{item.sku}</span>
                      <span className="text-orange-300/60">→</span>
                      <span>Necesita {item.requested}, disponible {item.available}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-orange-200/60 text-xs mt-3">
                  No podrá confirmar este despacho hasta que haya stock suficiente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-glass-lg mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Items del Despacho
          </h2>

          <div className="space-y-3">
            {dispatch.items?.map((item, index) => {
              // Buscar validación de stock para este item
              const stockInfo = stockValidation?.results?.find(
                r => r.product_id === item.product_id
              );

              const isInsufficient = stockInfo?.insufficient;

              return (
                <div
                  key={index}
                  className={`
                    p-4 rounded-xl border
                    ${isInsufficient
                      ? 'bg-red-500/5 border-red-500/30'
                      : 'bg-white/5 border-white/10'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Product Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`
                          font-mono text-sm
                          ${isInsufficient ? 'text-red-300' : 'text-white/80'}
                        `}>
                          {item.sku || item.product?.sku || 'N/A'}
                        </span>
                        {isInsufficient && (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <p className={`
                        text-sm
                        ${isInsufficient ? 'text-red-200/80' : 'text-white/60'}
                      `}>
                        {item.product_name || item.product?.name || 'Producto'}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-white/40 mt-1">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    {/* Quantity & Stock */}
                    <div className="text-right">
                      <div className={`
                        text-2xl font-bold
                        ${isInsufficient ? 'text-red-300' : 'text-white'}
                      `}>
                        {item.qty}
                      </div>
                      <p className="text-xs text-white/40">unidades</p>

                      {/* Stock Info */}
                      {stockInfo && (
                        <div className={`
                          mt-2 text-xs
                          ${isInsufficient ? 'text-red-300' : 'text-green-300'}
                        `}>
                          Stock: {stockInfo.available}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Items */}
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <span className="text-white/60">Total de items:</span>
            <span className="text-xl font-bold text-white">
              {dispatch.items?.length || 0}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          {/* Cancel Button */}
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="
              px-6 py-4 rounded-2xl
              bg-white/5 backdrop-blur-xl border border-white/10
              text-white font-medium
              hover:bg-white/10 hover:border-white/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
              flex items-center justify-center gap-2
            "
          >
            <X className="w-5 h-5" />
            Cancelar
          </button>

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            disabled={isProcessing || hasInsufficientStock}
            className={`
              px-6 py-4 rounded-2xl
              font-medium
              flex items-center justify-center gap-2
              transition-all
              ${hasInsufficientStock
                ? 'bg-gray-500/20 border-gray-500/30 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-400/30 text-white hover:shadow-lg hover:shadow-green-500/20'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {hasInsufficientStock ? 'Stock Insuficiente' : 'Confirmar Despacho'}
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm">
            {hasInsufficientStock
              ? '⚠️ Necesita recibir inventario antes de confirmar'
              : '✅ Al confirmar se crearán los movimientos de salida en el inventario'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

export default DispatchPreview;
