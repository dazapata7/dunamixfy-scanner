// =====================================================
// WAREHOUSE SELECTOR - Dunamix WMS
// =====================================================
// Selector de almacén antes de entrar al WMS
// Similar a StoreSelector pero para warehouses
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { warehousesService } from '../../services/wmsService';
import { MapPin, Loader2, ArrowLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function WarehouseSelector() {
  const navigate = useNavigate();
  const { operator, setSelectedWarehouse, selectedWarehouse } = useStore();

  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouses() {
    setIsLoading(true);
    try {
      const data = await warehousesService.getAll();
      setWarehouses(data);

      if (data.length === 0) {
        toast.error('No hay almacenes configurados');
      }

    } catch (error) {
      console.error('❌ Error al cargar almacenes:', error);
      toast.error('Error al cargar almacenes');
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectWarehouse(warehouse) {
    console.log('📍 Almacén seleccionado:', warehouse.name);
    setSelectedWarehouse(warehouse);
    toast.success(`Almacén: ${warehouse.name}`);
    navigate('/wms');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-glass-lg mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 rounded-2xl bg-white/10">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Seleccionar Almacén
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Operador: {operator}
              </p>
            </div>
          </div>

          {selectedWarehouse && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-green-300 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                Actualmente en: {selectedWarehouse.name}
              </p>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
          </div>
        )}

        {/* Warehouses List */}
        {!isLoading && warehouses.length > 0 && (
          <div className="space-y-3">
            {warehouses.map((warehouse) => {
              const isSelected = selectedWarehouse?.id === warehouse.id;

              return (
                <button
                  key={warehouse.id}
                  onClick={() => handleSelectWarehouse(warehouse)}
                  className={`
                    w-full group relative overflow-hidden
                    bg-white/5 backdrop-blur-xl rounded-2xl
                    border transition-all duration-300
                    p-6 text-left
                    hover:bg-white/10 hover:shadow-glass-lg hover:scale-[1.02]
                    ${isSelected
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-white/10'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`
                          p-2 rounded-lg
                          ${isSelected ? 'bg-green-500/20' : 'bg-white/10'}
                          group-hover:bg-white/20 transition-all
                        `}>
                          <MapPin className={`
                            w-5 h-5
                            ${isSelected ? 'text-green-400' : 'text-white/80'}
                          `} />
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {warehouse.name}
                            {isSelected && (
                              <Check className="w-4 h-4 text-green-400" />
                            )}
                          </h3>
                          <p className="text-white/40 text-xs">
                            {warehouse.code}
                          </p>
                        </div>
                      </div>

                      {warehouse.address && (
                        <p className="text-white/60 text-sm ml-11">
                          {warehouse.address}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="ml-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                        <svg
                          className="w-5 h-5 text-white/60 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && warehouses.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 mb-4">
              <MapPin className="w-12 h-12 text-white/40" />
            </div>
            <p className="text-white/60 mb-4">
              No hay almacenes configurados
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all"
            >
              Volver al Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WarehouseSelector;
