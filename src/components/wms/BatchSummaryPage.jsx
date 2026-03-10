// =====================================================
// BATCH SUMMARY PAGE - Dunamix WMS
// =====================================================
// Página que muestra el resumen del batch después de escanear
// Lee datos de sessionStorage guardados por ScanGuide
// =====================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BatchSummary } from './BatchSummary';
import { useWMS } from '../../hooks/useWMS';
import toast from 'react-hot-toast';

export function BatchSummaryPage() {
  const navigate = useNavigate();
  const { createAndConfirmDispatch, isProcessing } = useWMS();
  const [batchData, setBatchData] = useState(null);

  useEffect(() => {
    // Leer datos del batch desde sessionStorage
    const storedBatch = sessionStorage.getItem('wms_batch');
    console.log('📦 BatchSummaryPage - storedBatch:', storedBatch);

    if (!storedBatch) {
      console.error('❌ No hay datos en sessionStorage');
      toast.error('No hay datos de escaneo');
      navigate('/wms');
      return;
    }

    try {
      const data = JSON.parse(storedBatch);
      console.log('✅ Batch data parseado:', data);
      console.log('  - dispatches:', data.dispatches?.length);
      console.log('  - stats:', data.stats);
      console.log('  - warehouse:', data.warehouse);
      setBatchData(data);
    } catch (error) {
      console.error('Error al parsear batch data:', error);
      toast.error('Error al cargar datos del escaneo');
      navigate('/wms');
    }
  }, [navigate]);

  const handleConfirm = async () => {
    if (!batchData?.dispatches) return;

    try {
      // Confirmar todos los dispatches con categoría SUCCESS
      const confirmableDispatches = batchData.dispatches.filter(
        item => item.category === 'SUCCESS' && item.dispatch
      );

      if (confirmableDispatches.length === 0) {
        toast.error('No hay guías confirmables en este batch');
        return;
      }

      // 🔥 AGRUPAR items por guide_code (Interrápidisimo puede tener múltiples items por guía)
      const dispatchesByGuide = new Map();

      confirmableDispatches.forEach(item => {
        const guideCode = item.dispatch.guide_code;

        if (!dispatchesByGuide.has(guideCode)) {
          dispatchesByGuide.set(guideCode, item.dispatch);
        } else {
          const existing = dispatchesByGuide.get(guideCode);
          existing.items = [...existing.items, ...item.dispatch.items];
          console.log(`📦 Combinando items para guía ${guideCode}: ${existing.items.length} items totales`);
        }
      });

      const uniqueDispatches = Array.from(dispatchesByGuide.values());
      console.log(`📊 Dispatches únicos después de agrupar: ${uniqueDispatches.length} (de ${confirmableDispatches.length} escaneados)`);

      toast.loading(`Confirmando ${uniqueDispatches.length} guías...`, { id: 'confirm-batch' });

      const confirmPromises = uniqueDispatches.map(dispatch =>
        createAndConfirmDispatch(dispatch)
          .then(result => ({ success: true, result }))
          .catch(error => ({ success: false, error, guide: dispatch.guide_code }))
      );

      const results = await Promise.allSettled(confirmPromises);

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      console.log('📊 Resultados confirmación:', { total: results.length, successful, failed: failed.length });

      if (failed.length > 0) {
        console.error('❌ Guías con error:', failed.map(f => f.value?.guide || 'unknown'));
      }

      sessionStorage.removeItem('wms_batch');

      if (successful > 0) {
        if (failed.length > 0) {
          toast.success(`${successful} confirmados, ${failed.length} con error`, { id: 'confirm-batch', duration: 5000 });
        } else {
          toast.success(`${successful} despachos confirmados`, { id: 'confirm-batch' });
        }
      } else {
        toast.error('Error al confirmar despachos', { id: 'confirm-batch' });
      }

      navigate('/wms');
    } catch (error) {
      console.error('Error crítico al confirmar batch:', error);
      toast.error('Error crítico al confirmar despachos', { id: 'confirm-batch' });
      sessionStorage.removeItem('wms_batch');
      navigate('/wms');
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('wms_batch');
    toast('Escaneo cancelado', { icon: '⚠️' });
    navigate('/wms');
  };

  if (!batchData) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/10 border-t-primary-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <BatchSummary
      batch={batchData.dispatches}
      stats={batchData.stats}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      isProcessing={isProcessing}
    />
  );
}

export default BatchSummaryPage;
