import { useState } from 'react';
import { operatorsService } from '../services/supabase';
import { useStore } from '../store/useStore';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function Login() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setOperator = useStore((state) => state.setOperator);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Por favor ingresa tu nombre');
      return;
    }

    setIsLoading(true);

    try {
      // Obtener o crear operario
      const operator = await operatorsService.getOrCreate(name.trim());
      
      // Guardar en el store
      setOperator(operator.name, operator.id);
      
      toast.success(`¡Bienvenido ${operator.name}!`);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      toast.error('Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/dunfy_fondo_coscuro.png" 
            alt="Dunamix" 
            className="h-24 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-white mb-2">
            Dunamix Scanner
          </h1>
          <p className="text-gray-400">
            Control de entregas QR/Barcode
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-dark-800 rounded-2xl shadow-2xl p-8 border border-primary-500/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="name" 
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Nombre del Operario
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ingresa tu nombre"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-dark-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50"
                autoComplete="off"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Iniciando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Versión 1.0 • React + Supabase</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// V4: Export default para lazy loading
export default Login;
