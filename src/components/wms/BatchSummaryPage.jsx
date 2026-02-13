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

      // Crear y confirmar cada dispatch (ahora se crean en BD al confirmar)
      for (const item of confirmableDispatches) {
        await createAndConfirmDispatch(item.dispatch);
      }

      toast.success(`✅ ${confirmableDispatches.length} despachos confirmados`);

      // Limpiar sessionStorage
      sessionStorage.removeItem('wms_batch');

      // Volver a WMS Home
      navigate('/wms');
    } catch (error) {
      console.error('Error al confirmar batch:', error);
      toast.error('Error al confirmar despachos');
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
