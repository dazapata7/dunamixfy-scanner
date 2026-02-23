// =====================================================
// REGISTER COMPANY - Dunamix WMS
// =====================================================
// Pantalla post-login para usuarios sin empresa asignada
// Al completar, el usuario se convierte en Admin
// =====================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { companiesService } from '../services/companiesService';
import { Building2, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function RegisterCompany() {
  const navigate = useNavigate();
  const { operatorId, setUserProfile, setOperator, operator } = useStore();

  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Ingresa el nombre de tu empresa');
      return;
    }

    setIsLoading(true);
    try {
      const companyId = await companiesService.registerCompany(
        operatorId,
        companyName.trim(),
        companyEmail.trim() || null
      );

      // Actualizar store con nuevo rol y empresa
      setUserProfile('admin', companyId, companyName.trim());

      toast.success(`Empresa "${companyName}" creada. ¡Bienvenido Admin!`);
      navigate('/admin');
    } catch (error) {
      console.error('Error al registrar empresa:', error);
      toast.error(error.message || 'Error al crear empresa');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo / Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-3xl bg-indigo-500/20 mb-4">
            <Building2 className="w-12 h-12 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Crea tu Empresa</h1>
          <p className="text-white/60 mt-2">
            Hola <span className="text-white font-medium">{operator}</span>, registra tu empresa para comenzar
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-glass-lg">

          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-indigo-200 text-sm">
              Al registrar tu empresa, te conviertes en <strong>Administrador</strong> y podrás gestionar bodegas y operadores.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Nombre de la Empresa *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ej: Logística XYZ S.A.S"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Email de Contacto <span className="text-white/40">(opcional)</span>
              </label>
              <input
                type="email"
                value={companyEmail}
                onChange={e => setCompanyEmail(e.target.value)}
                placeholder="empresa@dominio.com"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !companyName.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-3 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Crear Empresa y Continuar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          ¿Fuiste invitado por un Admin? Pídele que te agregue desde su panel.
        </p>
      </div>
    </div>
  );
}

export default RegisterCompany;
