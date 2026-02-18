// =====================================================
// BATCH SUMMARY - Resumen de Guías Escaneadas
// =====================================================
// Muestra resumen detallado por categorías
// Con opción de confirmar solo nuevas u omitir repetidas
// =====================================================

export function BatchSummary({ batch, stats, onConfirm, onCancel, isProcessing, confirmProgress }) {
  const {
    success,
    repeatedToday,
    repeatedOtherDay,
    draftDuplicate,
    alreadyScanned,
    errorNotReady,
    errorNotFound,
    errorOther,
    total,
    confirmable
  } = stats;

  const hasRepeated = repeatedToday > 0 || repeatedOtherDay > 0 || draftDuplicate > 0;
  const hasErrors = alreadyScanned > 0 || errorNotReady > 0 || errorNotFound > 0 || errorOther > 0;
  const omitted = total - confirmable;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            📊 Resumen de Escaneo
          </h1>
          <p className="text-white/60">
            {total} guías escaneadas • {confirmable} confirmables • {omitted} omitidas
          </p>
        </div>

        {/* Guías Nuevas (SUCCESS) */}
        {success > 0 && (
          <div className="mb-6">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6 shadow-glass-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">✅ Guías NUEVAS ({success})</h2>
                <span className="px-3 py-1 bg-green-500/30 text-green-100 rounded-lg text-sm font-bold">
                  SE CONFIRMARÁN
                </span>
              </div>
              <div className="space-y-2">
                {batch
                  .filter(item => item.category === 'SUCCESS')
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/5 rounded-xl p-3"
                    >
                      <div className="flex-1">
                        <p className="text-white font-mono font-bold">
                          {item.feedbackInfo.code}
                        </p>
                        <p className="text-white/60 text-sm">
                          {item.feedbackInfo.carrier} • {item.feedbackInfo.customerName || 'Cliente'} • {item.feedbackInfo.itemsCount} items
                        </p>
                      </div>
                      <span className="text-green-400 text-sm font-medium">
                        {item.dispatch?.dispatch_number}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Guías Repetidas */}
        {hasRepeated && (
          <div className="mb-6">
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl border border-yellow-500/30 p-6 shadow-glass-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  ⚠️ Guías REPETIDAS ({repeatedToday + repeatedOtherDay + draftDuplicate})
                </h2>
                <span className="px-3 py-1 bg-yellow-500/30 text-yellow-100 rounded-lg text-sm font-bold">
                  SE OMITIRÁN
                </span>
              </div>

              {/* Repetidas de HOY */}
              {repeatedToday > 0 && (
                <div className="mb-4">
                  <p className="text-yellow-200 font-medium mb-2">📅 Repetidas de HOY ({repeatedToday})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'REPEATED_TODAY')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">{item.message}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Repetidas de OTROS DÍAS */}
              {repeatedOtherDay > 0 && (
                <div className="mb-4">
                  <p className="text-yellow-200 font-medium mb-2">📆 Repetidas de OTROS DÍAS ({repeatedOtherDay})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'REPEATED_OTHER_DAY')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">{item.message}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Drafts duplicados */}
              {draftDuplicate > 0 && (
                <div>
                  <p className="text-yellow-200 font-medium mb-2">📝 En borrador ({draftDuplicate})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'DRAFT_DUPLICATE')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">Dispatch en borrador</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Guías con Error */}
        {hasErrors && (
          <div className="mb-6">
            <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6 shadow-glass-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  ❌ Guías con ERROR ({alreadyScanned + errorNotReady + errorNotFound + errorOther})
                </h2>
                <span className="px-3 py-1 bg-red-500/30 text-red-100 rounded-lg text-sm font-bold">
                  SE OMITIRÁN
                </span>
              </div>

              {alreadyScanned > 0 && (
                <div className="mb-4">
                  <p className="text-red-200 font-medium mb-2">🔄 Ya escaneadas en Dunamixfy ({alreadyScanned})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'ALREADY_SCANNED_EXTERNAL')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">{item.message}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {errorNotReady > 0 && (
                <div className="mb-4">
                  <p className="text-red-200 font-medium mb-2">🚫 No listas para despacho ({errorNotReady})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'ERROR_NOT_READY')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">{item.message}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {errorNotFound > 0 && (
                <div className="mb-4">
                  <p className="text-red-200 font-medium mb-2">❓ No encontradas ({errorNotFound})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'ERROR_NOT_FOUND')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">{item.message}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {errorOther > 0 && (
                <div>
                  <p className="text-red-200 font-medium mb-2">⚠️ Otros errores ({errorOther})</p>
                  <div className="space-y-2">
                    {batch
                      .filter(item => item.category === 'ERROR_OTHER')
                      .map((item, index) => (
                        <div key={index} className="bg-white/5 rounded-xl p-3">
                          <p className="text-white font-mono">{item.feedbackInfo.code}</p>
                          <p className="text-white/60 text-sm">{item.message}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resumen Final */}
        <div className="bg-gradient-to-br from-primary-500/20 to-blue-500/20 backdrop-blur-xl rounded-2xl border border-primary-500/30 p-6 shadow-glass-lg mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-white/60 text-sm mb-1">Total Escaneadas</p>
              <p className="text-white font-bold text-4xl">{total}</p>
            </div>
            <div className="text-center">
              <p className="text-green-200 text-sm mb-1">Se Confirmarán</p>
              <p className="text-green-400 font-bold text-4xl">{confirmable}</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-200 text-sm mb-1">Se Omitirán</p>
              <p className="text-yellow-400 font-bold text-4xl">{omitted}</p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-6 py-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            ❌ Cancelar y Volver
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || confirmable === 0}
            className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {confirmProgress
                  ? `Confirmando ${confirmProgress.current} de ${confirmProgress.total}...`
                  : 'Confirmando...'}
              </span>
            ) : confirmable === 0 ? (
              'Sin guías para confirmar'
            ) : (
              `✅ Confirmar ${confirmable} Guía${confirmable > 1 ? 's' : ''} Nueva${confirmable > 1 ? 's' : ''}`
            )}
          </button>
        </div>

        {/* Overlay de progreso (bloquea toda la pantalla mientras confirma) */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-dark-900 border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
              <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-white font-bold text-xl mb-2">Confirmando despachos</h3>
              {confirmProgress ? (
                <>
                  <p className="text-green-400 font-bold text-3xl mb-1">
                    {confirmProgress.current} / {confirmProgress.total}
                  </p>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(confirmProgress.current / confirmProgress.total) * 100}%` }}
                    />
                  </div>
                  {confirmProgress.currentCode && (
                    <p className="text-white/40 text-xs font-mono mt-3 truncate">
                      {confirmProgress.currentCode}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/60 text-sm">Por favor espere...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchSummary;
