// =====================================================
// USER PROFILE - Dunamix WMS
// =====================================================
// Perfil del usuario con datos, rol, empresa y bodegas
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';
import { companiesService } from '../services/companiesService';
import { supabase } from '../services/supabase';
import {
  ArrowLeft, User, Building2, Warehouse, Shield, LogOut,
  Mail, Hash, Calendar, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export function UserProfile() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const operator   = useStore((s) => s.operator);
  const operatorId = useStore((s) => s.operatorId);
  const role       = useStore((s) => s.role);
  const companyId  = useStore((s) => s.companyId);
  const companyName = useStore((s) => s.companyName);

  const [assignedWarehouses, setAssignedWarehouses] = useState([]);
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [operatorCount, setOperatorCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createdAt, setCreatedAt] = useState(null);

  useEffect(() => {
    loadData();
  }, [operatorId, role, companyId]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Fecha de creación del operador
      const { data: opData } = await supabase
        .from('operators')
        .select('created_at, email')
        .eq('id', operatorId)
        .single();
      if (opData) setCreatedAt(opData.created_at);

      if (role === 'operator' && operatorId) {
        // Operador: carga sus bodegas asignadas
        const whs = await companiesService.getOperatorWarehouses(operatorId);
        setAssignedWarehouses(whs);
      } else if ((role === 'admin' || role === 'superadmin') && companyId) {
        // Admin: carga todas las bodegas de la empresa + conteo de operadores
        const [whs, ops] = await Promise.all([
          companiesService.getWarehouses(companyId),
          companiesService.getOperators(companyId)
        ]);
        setAllWarehouses(whs);
        setOperatorCount(ops.length);
      }
    } catch (err) {
      console.warn('Error cargando datos de perfil:', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Iniciales para avatar
  const initials = operator
    ? operator.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const roleBadge = {
    superadmin: { label: 'Super Admin', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    admin:      { label: 'Administrador', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    operator:   { label: 'Operador',    cls: 'bg-green-500/20  text-green-300  border-green-500/30'  },
  }[role] || { label: 'Usuario', cls: 'bg-white/10 text-white/50 border-white/20' };

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Mi Perfil</h1>
        </div>

        {/* Avatar + nombre */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-4 text-center">
          {/* Avatar circle */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/50 to-indigo-500/50 border-2 border-white/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-2xl">{initials}</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">{operator || 'Usuario'}</h2>
          {user?.email && (
            <p className="text-white/50 text-sm mb-3">{user.email}</p>
          )}
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${roleBadge.cls}`}>
            {roleBadge.label}
          </span>
        </div>

        {/* Info cards */}
        <div className="space-y-3 mb-4">

          {/* Email */}
          {user?.email && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/8">
              <div className="p-2.5 rounded-xl bg-blue-500/15">
                <Mail className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs">Email</p>
                <p className="text-white/90 text-sm font-medium">{user.email}</p>
              </div>
            </div>
          )}

          {/* Empresa */}
          {companyName && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/8">
              <div className="p-2.5 rounded-xl bg-indigo-500/15">
                <Building2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-xs">Empresa / Warehouse</p>
                <p className="text-white/90 text-sm font-medium truncate">{companyName}</p>
              </div>
              {(role === 'admin' || role === 'superadmin') && operatorCount !== null && (
                <span className="text-white/40 text-xs">{operatorCount} operadores</span>
              )}
            </div>
          )}

          {/* ID interno */}
          {operatorId && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/8">
              <div className="p-2.5 rounded-xl bg-white/8">
                <Hash className="w-4 h-4 text-white/40" />
              </div>
              <div className="min-w-0">
                <p className="text-white/40 text-xs">ID de usuario</p>
                <p className="text-white/50 text-xs font-mono truncate">{operatorId}</p>
              </div>
            </div>
          )}

          {/* Fecha de registro */}
          {formattedDate && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/8">
              <div className="p-2.5 rounded-xl bg-white/8">
                <Calendar className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <p className="text-white/40 text-xs">Miembro desde</p>
                <p className="text-white/70 text-sm">{formattedDate}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bodegas (Operador) */}
        {role === 'operator' && !isLoading && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-5 mb-4">
            <h3 className="text-white/70 text-sm font-semibold mb-3 flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-primary-400" />
              Bodegas asignadas
            </h3>
            {assignedWarehouses.length === 0 ? (
              <p className="text-white/30 text-sm">Sin bodegas asignadas</p>
            ) : (
              <div className="space-y-2">
                {assignedWarehouses.map(wh => (
                  <div key={wh.id} className={`flex items-center gap-3 p-3 rounded-xl border ${wh.is_active ? 'bg-white/5 border-white/10' : 'border-white/5 opacity-50'}`}>
                    <div className="p-1.5 rounded-lg bg-primary-500/15">
                      <Warehouse className="w-3.5 h-3.5 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-medium truncate">{wh.name}</p>
                      <p className="text-white/40 text-xs font-mono">{wh.code}</p>
                    </div>
                    {!wh.is_active && <span className="text-xs text-white/30">inactiva</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bodegas (Admin/SuperAdmin) */}
        {(role === 'admin' || role === 'superadmin') && !isLoading && allWarehouses.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white/70 text-sm font-semibold flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-blue-400" />
                Bodegas de la empresa
              </h3>
              <button
                onClick={() => navigate('/admin/bodegas')}
                className="text-xs text-blue-400/70 hover:text-blue-300 flex items-center gap-1"
              >
                Gestionar <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {allWarehouses.map(wh => (
                <div key={wh.id} className={`flex items-center gap-3 p-3 rounded-xl border ${wh.is_active ? 'bg-white/5 border-white/10' : 'border-white/5 opacity-50'}`}>
                  <div className="p-1.5 rounded-lg bg-blue-500/15">
                    <Warehouse className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{wh.name}</p>
                    <p className="text-white/40 text-xs font-mono">{wh.code}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${wh.is_active ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-white/30 border-white/10'}`}>
                    {wh.is_active ? 'activa' : 'inactiva'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accesos rápidos por rol */}
        {(role === 'admin' || role === 'superadmin') && (
          <div className="space-y-2 mb-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
            >
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-300 text-sm font-medium">Panel de Administración</span>
              <ChevronRight className="w-4 h-4 text-indigo-400/40 ml-auto" />
            </button>
            {role === 'superadmin' && (
              <button
                onClick={() => navigate('/superadmin')}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all"
              >
                <Shield className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-300 text-sm font-medium">Panel Super Admin</span>
                <ChevronRight className="w-4 h-4 text-yellow-400/40 ml-auto" />
              </button>
            )}
          </div>
        )}

        {/* Cerrar sesión */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all font-medium"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>

      </div>
    </div>
  );
}

export default UserProfile;
