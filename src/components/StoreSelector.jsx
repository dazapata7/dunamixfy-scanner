import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Store, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

// Lista de tiendas predefinidas (puedes editarlas)
const DEFAULT_STORES = [
  'Dunamixfy',
  'Femme Cosmetics',
  'Store 1',
  'Store 2',
  'Store 3'
];

export function StoreSelector({ onClose }) {
  const { selectedStore, setSelectedStore } = useStore();
  const [customStore, setCustomStore] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleSelectStore = (store) => {
    setSelectedStore(store);
    toast.success(`Tienda seleccionada: ${store}`);
    onClose();
  };

  const handleCustomStore = () => {
    if (!customStore.trim()) {
      toast.error('Ingresa el nombre de la tienda');
      return;
    }
    handleSelectStore(customStore.trim());
  };

  const handleSkip = () => {
    setSelectedStore(null);
    toast('Sin tienda seleccionada', { icon: 'ℹ️' });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-800 rounded-2xl max-w-md w-full p-6 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Store className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Seleccionar Tienda</h2>
              <p className="text-sm text-gray-400">¿De qué tienda son estos códigos?</p>
            </div>
          </div>
          
          <button
            onClick={handleSkip}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tienda actual */}
        {selectedStore && (
          <div className="mb-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
            <p className="text-sm text-gray-300">Tienda actual:</p>
            <p className="text-white font-semibold">{selectedStore}</p>
          </div>
        )}

        {/* Lista de tiendas */}
        <div className="space-y-2 mb-4">
          {DEFAULT_STORES.map((store) => (
            <button
              key={store}
              onClick={() => handleSelectStore(store)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                selectedStore === store
                  ? 'bg-primary-500 text-dark-900 font-semibold'
                  : 'bg-dark-700 text-white hover:bg-dark-600'
              }`}
            >
              {store}
            </button>
          ))}
        </div>

        {/* Input personalizado */}
        {showCustomInput ? (
          <div className="space-y-2">
            <input
              type="text"
              value={customStore}
              onChange={(e) => setCustomStore(e.target.value)}
              placeholder="Nombre de la tienda"
              className="w-full px-4 py-3 bg-dark-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleCustomStore()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCustomStore}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomStore('');
                }}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors border border-gray-600 border-dashed"
          >
            <Plus className="w-5 h-5" />
            <span>Otra tienda</span>
          </button>
        )}

        {/* Botón omitir */}
        <button
          onClick={handleSkip}
          className="w-full mt-4 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Omitir (sin tienda)
        </button>
      </div>
    </div>
  );
}
