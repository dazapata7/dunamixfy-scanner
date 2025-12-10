import { useState, useEffect } from 'react';
import { codesService } from '../services/supabase';
import { ArrowLeft, Package, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function Stats({ onBack }) {
  const [codes, setCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('today'); // 'today', 'week', 'all'

  useEffect(() => {
    loadCodes();
  }, [filter]);

  const loadCodes = async () => {
    setIsLoading(true);
    try {
      let data;
      
      if (filter === 'today') {
        data = await codesService.getToday();
      } else {
        data = await codesService.getAll();
        
        if (filter === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          data = data.filter(code => new Date(code.created_at) >= weekAgo);
        }
      }
      
      setCodes(data);
    } catch (error) {
      console.error('Error cargando códigos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Código', 'Transportadora', 'Tienda', 'Cliente', 'Pedido', 'Operario'];
    const rows = codes.map(code => [
      format(new Date(code.created_at), 'yyyy-MM-dd HH:mm:ss'),
      code.code,
      code.carrier_name || code.carriers?.display_name || 'N/A',
      code.store_name || 'Sin tienda',
      code.customer_name || 'N/A',
      code.order_id || 'N/A',
      code.operators?.name || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dunamix-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Calcular estadísticas dinámicamente por transportadora
  const stats = {
    total: codes.length,
    byCarrier: {},
    byStore: {}
  };

  codes.forEach(code => {
    const carrier = code.carrier_name || code.carriers?.display_name;
    if (carrier) {
      stats.byCarrier[carrier] = (stats.byCarrier[carrier] || 0) + 1;
    }
    if (code.store_name) {
      stats.byStore[code.store_name] = (stats.byStore[code.store_name] || 0) + 1;
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-800 border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver</span>
            </button>
            
            <h1 className="text-xl font-bold text-white">Estadísticas</h1>

            <button
              onClick={exportToCSV}
              className="p-2 rounded-lg bg-primary-500 text-dark-900 hover:bg-primary-600 transition-colors"
              title="Exportar CSV"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            {['today', 'week', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-dark-900'
                    : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                }`}
              >
                {f === 'today' && 'Hoy'}
                {f === 'week' && 'Esta Semana'}
                {f === 'all' && 'Todo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Resumen Total */}
        <div className="bg-dark-800 rounded-xl p-6 border border-gray-700 text-center">
          <p className="text-sm text-gray-400 mb-2">Total Escaneado</p>
          <p className="text-4xl font-bold text-primary-500">{stats.total}</p>
        </div>

        {/* Estadísticas por Transportadora */}
        {Object.keys(stats.byCarrier).length > 0 && (
          <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Por Transportadora</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(stats.byCarrier)
                .sort(([, a], [, b]) => b - a)
                .map(([carrier, count]) => (
                  <div key={carrier} className="bg-dark-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">{carrier}</p>
                    <p className="text-2xl font-bold text-blue-400">{count}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Estadísticas por Tienda */}
        {Object.keys(stats.byStore).length > 0 && (
          <div className="bg-dark-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Por Tienda</h3>
            <div className="space-y-2">
              {Object.entries(stats.byStore)
                .sort(([, a], [, b]) => b - a)
                .map(([store, count]) => (
                  <div key={store} className="bg-dark-900 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                    <span className="text-gray-300 font-medium">{store}</span>
                    <span className="text-xl font-bold text-primary-500">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Listado */}
        <div className="bg-dark-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 bg-dark-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5" />
              Historial de Escaneos ({codes.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 mt-2">Cargando...</p>
            </div>
          ) : codes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No hay códigos escaneados
            </div>
          ) : (
            <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
              {codes.map((code) => (
                <div key={code.id} className="p-4 hover:bg-dark-700 transition-colors">
                  <div className="space-y-3">
                    {/* Código y badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-lg font-semibold text-white">
                        {code.code}
                      </p>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        {code.carrier_name || code.carriers?.display_name || 'Sin transportadora'}
                      </span>
                      {code.store_name && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                          {code.store_name}
                        </span>
                      )}
                    </div>

                    {/* Detalles del pedido */}
                    {(code.customer_name || code.order_id) && (
                      <div className="bg-dark-900 rounded-lg p-3 space-y-1">
                        {code.customer_name && (
                          <p className="text-sm text-white">
                            👤 {code.customer_name}
                          </p>
                        )}
                        {code.order_id && (
                          <p className="text-xs text-gray-400">
                            Pedido #{code.order_id}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Fecha y hora */}
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(code.created_at), 'dd MMM yyyy', { locale: es })}
                      </span>
                      <span>
                        {format(new Date(code.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
