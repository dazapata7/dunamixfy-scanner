// =====================================================
// DEBUG GUIDE - Página de Testing Visual
// =====================================================
// Permite probar el flujo completo con logs visuales
// Perfecto para debugging en iPhone/Android
// =====================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWMS } from '../../hooks/useWMS';
import { useStore } from '../../store/useStore';
import { ArrowLeft } from 'lucide-react';

export function DebugGuide() {
  const navigate = useNavigate();
  const { scanGuideForDispatch } = useWMS();
  const { operatorId } = useStore();

  const [guideCode, setGuideCode] = useState('70020220500010501656814005796001');
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const addLog = (emoji, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, {
      time: timestamp,
      emoji,
      message,
      data: data ? JSON.stringify(data, null, 2) : null
    }]);
  };

  const testGuide = async () => {
    setLogs([]);
    setResult(null);
    setIsProcessing(true);

    try {
      addLog('🎬', 'INICIANDO PRUEBA');
      addLog('📦', `Código a probar: ${guideCode}`);
      addLog('🧑', `Operador ID: ${operatorId || 'NO DEFINIDO'}`);

      if (!operatorId) {
        addLog('❌', 'ERROR: No hay operador. Debes hacer login primero.');
        setIsProcessing(false);
        return;
      }

      addLog('⏳', 'Procesando con scanGuideForDispatch...');

      const startTime = Date.now();
      const scanResult = await scanGuideForDispatch(guideCode, operatorId);
      const elapsed = Date.now() - startTime;

      addLog('⏱️', `Procesamiento completado en ${elapsed}ms`);
      addLog('📊', 'Resultado recibido', scanResult);

      // Analizar categoría
      const category = scanResult.category || 'UNKNOWN';

      switch (category) {
        case 'SUCCESS':
          addLog('✅', 'CATEGORÍA: SUCCESS (Guía nueva)');
          addLog('📝', `Dispatch creado: ${scanResult.dispatch?.dispatch_number}`);
          break;
        case 'REPEATED_TODAY':
          addLog('⚠️', 'CATEGORÍA: REPEATED_TODAY (Ya despachada hoy)');
          addLog('📅', scanResult.message);
          break;
        case 'REPEATED_OTHER_DAY':
          addLog('📅', 'CATEGORÍA: REPEATED_OTHER_DAY (Despachada otro día)');
          addLog('📅', scanResult.message);
          break;
        case 'DRAFT_DUPLICATE':
          addLog('📝', 'CATEGORÍA: DRAFT_DUPLICATE (Dispatch en borrador)');
          break;
        case 'ALREADY_SCANNED_EXTERNAL':
          addLog('🔄', 'CATEGORÍA: ALREADY_SCANNED_EXTERNAL (Escaneada en Dunamixfy)');
          addLog('📝', scanResult.message);
          break;
        case 'ERROR_NOT_READY':
          addLog('🚫', 'CATEGORÍA: ERROR_NOT_READY (No listo para despacho)');
          addLog('📝', scanResult.message);
          break;
        case 'ERROR_NOT_FOUND':
          addLog('❌', 'CATEGORÍA: ERROR_NOT_FOUND (Guía no existe)');
          addLog('📝', scanResult.message);
          break;
        case 'ERROR_OTHER':
          addLog('⚠️', 'CATEGORÍA: ERROR_OTHER (Otro error)');
          addLog('📝', scanResult.message);
          break;
        default:
          addLog('❓', `CATEGORÍA DESCONOCIDA: ${category}`);
      }

      if (scanResult.feedbackInfo) {
        addLog('ℹ️', 'Información de feedback', scanResult.feedbackInfo);
      }

      setResult(scanResult);

    } catch (error) {
      addLog('💥', 'ERROR FATAL', {
        message: error.message,
        stack: error.stack
      });
    } finally {
      setIsProcessing(false);
      addLog('🏁', 'PRUEBA FINALIZADA');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/wms')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <h1 className="text-xl font-bold text-white">🔍 Debug Guide</h1>
        </div>

        {/* Input */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
          <label className="block text-white/80 text-sm mb-2">
            Número de Guía
          </label>
          <input
            type="text"
            value={guideCode}
            onChange={(e) => setGuideCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-lg mb-4"
            placeholder="Ej: 70020220500010501656814005796001"
          />
          <button
            onClick={testGuide}
            disabled={isProcessing || !guideCode}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </span>
            ) : (
              '▶️ Probar Guía'
            )}
          </button>
        </div>

        {/* Resultado Resumido */}
        {result && (
          <div className={`backdrop-blur-xl rounded-2xl border p-6 mb-6 ${
            result.category === 'SUCCESS'
              ? 'bg-green-500/20 border-green-500/30'
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            <h2 className="text-white font-bold text-lg mb-2">
              📊 Resultado: {result.category || 'UNKNOWN'}
            </h2>
            <p className="text-white/80">
              {result.message || 'Sin mensaje'}
            </p>
            {result.dispatch && (
              <p className="text-white/60 text-sm mt-2">
                Dispatch: {result.dispatch.dispatch_number}
              </p>
            )}
          </div>
        )}

        {/* Logs */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-white font-bold text-lg mb-4">
            📋 Log de Ejecución ({logs.length})
          </h2>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-white/40 text-center py-8">
                No hay logs todavía. Presiona "Probar Guía" para iniciar.
              </p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className="bg-white/5 rounded-xl p-4 border border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{log.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white/40 text-xs font-mono">
                          {log.time}
                        </span>
                        <span className="text-white font-medium">
                          {log.message}
                        </span>
                      </div>
                      {log.data && (
                        <pre className="text-xs text-white/60 bg-black/30 rounded p-2 overflow-x-auto mt-2">
                          {log.data}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instrucciones */}
        <div className="mt-6 bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4">
          <p className="text-blue-200 text-sm">
            💡 <strong>Tip:</strong> Esta página te permite probar el flujo completo de clasificación
            de guías sin necesitar la cámara. Perfecto para debugging en iPhone/Android.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DebugGuide;
