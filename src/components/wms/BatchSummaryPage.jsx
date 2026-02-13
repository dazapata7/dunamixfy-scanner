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

      // ⚡ OPTIMIZACIÓN: Crear y confirmar dispatches EN PARALELO con manejo de errores individuales
      toast.loading(`Confirmando ${confirmableDispatches.length} guías...`, { id: 'confirm-batch' });

      const confirmPromises = confirmableDispatches.map(item =>
        createAndConfirmDispatch(item.dispatch)
          .then(result => ({ success: true, result }))
          .catch(error => ({ success: false, error, guide: item.dispatch.guide_code }))
      );

      const results = await Promise.allSettled(confirmPromises);

      // Contar éxitos y errores
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      console.log('📊 Resultados confirmación:', { total: results.length, successful, failed: failed.length });

      if (failed.length > 0) {
        console.error('❌ Guías con error:', failed.map(f => f.value?.guide || 'unknown'));
      }

      // Limpiar sessionStorage SIEMPRE (incluso si hay errores)
      sessionStorage.removeItem('wms_batch');

      if (successful > 0) {
        if (failed.length > 0) {
          toast.success(`✅ ${successful} confirmados, ⚠️ ${failed.length} con error`, { id: 'confirm-batch', duration: 5000 });
        } else {
          toast.success(`✅ ${successful} despachos confirmados`, { id: 'confirm-batch' });
        }
      } else {
        toast.error(`❌ Error al confirmar despachos`, { id: 'confirm-batch' });
      }

      // Volver a WMS Home (siempre, incluso si hubo errores)
      navigate('/wms');
    } catch (error) {
      console.error('Error crítico al confirmar batch:', error);
      toast.error('Error crítico al confirmar despachos', { id: 'confirm-batch' });
      // Limpiar sessionStorage incluso en error crítico
      sessionStorage.removeItem('wms_batch');
      navigate('/wms');
    }
  };

  const handleCancel = () => {
    // TODO: Eliminar dispatches en DRAFT del batch
    // Por ahora solo limpiamos sessionStorage y volvemos
    sessionStorage.removeItem('wms_batch');
    toast('Escaneo cancelado', { icon: '⚠️' });
    navigate('/wms');
  };

  if (!batchData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Cargando resumen...</p>
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
