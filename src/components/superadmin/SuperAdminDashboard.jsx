// =====================================================
// SUPERADMIN DASHBOARD - Dunamix WMS
// =====================================================
// Panel de administración global de la plataforma
// Ve todas las empresas, gestiona transportadoras
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { companiesService } from '../../services/companiesService';
import { supabase } from '../../services/supabase';
import {
  Shield, Building2, Users, Truck, ChevronRight, ArrowLeft,
  ToggleLeft, ToggleRight, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { operator } = useStore();

  const [tab, setTab] = useState('companies');
  const [companies, setCompanies] = useState([]);
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setIsLoading(true);
    try {
      if (tab === 'companies') {
        const data = await companiesService.getAll();
        setCompanies(data);
      } else if (tab === 'operators') {
        const data = await companiesService.getAllOperators();
        setOperators(data);
      }
    } catch (err) {
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleCompany(company) {
    try {
      await companiesService.update(company.id, { is_active: !company.is_active });
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, is_active: !company.is_active } : c));
      toast.success(company.is_active ? 'Empresa desactivada' : 'Empresa activada');
    } catch (err) {
      toast.error('Error al actualizar empresa');
    }
  }

  async function changeRole(operatorId, newRole) {
    try {
      await companiesService.setOperatorRole(operatorId, newRole);
      setOperators(prev => prev.map(op => op.id === operatorId ? { ...op, role: newRole } : op));
      toast.success(`Rol actualizado a ${newRole}`);
    } catch (err) {
      toast.error('Error al cambiar rol');
    }
  }

  const roleColors = {
    superadmin: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30',
    admin: 'text-indigo-300 bg-indigo-500/20 border-indigo-500/30',
    operator: 'text-green-300 bg-green-500/20 border-green-500/30'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/wms')} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-yellow-400" />
              Super Admin
            </h1>
            <p className="text-white/60 text-sm">{operator} · Acceso global</p>
          </div>
          <button onClick={loadData} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => navigate('/wms')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-all"
          >
            <ChevronRight className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">Ir al WMS</span>
          </button>
          <button
            onClick={() => navigate('/wms/products')}
            className="flex items-center gap-3 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-all"
          >
            <Truck className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-sm font-medium">Gestionar Productos</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { id: 'companies', label: 'Empresas', icon: <Building2 className="w-4 h-4" /> },
            { id: 'operators', label: 'Usuarios', icon: <Users className="w-4 h-4" /> }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Companies Tab */}
        {tab === 'companies' && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay empresas registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {companies.map(company => (
                  <div
                    key={company.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      company.is_active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-indigo-500/20">
                      <Building2 className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{company.name}</p>
                      {company.email && <p className="text-white/50 text-xs">{company.email}</p>}
                      <p className="text-white/30 text-xs font-mono">{company.id.slice(0, 8)}...</p>
                    </div>
                    <button
                      onClick={() => toggleCompany(company)}
                      className={`p-2 rounded-lg transition-all ${company.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-white/30 hover:bg-white/10'}`}
                    >
                      {company.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Operators Tab */}
        {tab === 'operators' && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {operators.map(op => (
                  <div key={op.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white font-medium truncate">{op.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${roleColors[op.role] || roleColors.operator}`}>
                          {op.role}
                        </span>
                      </div>
                      <p className="text-white/50 text-xs">{op.email}</p>
                      {op.companies?.name && (
                        <p className="text-indigo-300/60 text-xs">{op.companies.name}</p>
                      )}
                    </div>
                    {/* Role selector */}
                    <select
                      value={op.role}
                      onChange={e => changeRole(op.id, e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:border-white/40 transition-all"
                    >
                      <option value="operator">Operador</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">SuperAdmin</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
