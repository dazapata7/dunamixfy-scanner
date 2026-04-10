import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, LogIn, UserPlus, ArrowLeft } from 'lucide-react';

const inputCls = "w-full bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white/80 placeholder-white/25 focus:outline-none focus:border-primary-500/40 focus:bg-white/[0.06] transition-all px-3 py-3";

export function LoginAuth() {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (mode === 'login')        await signInWithEmail(email, password);
    else if (mode === 'register') await signUpWithEmail(email, password, { name });
    else if (mode === 'forgot')   await resetPassword(email);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,146,10,0.07) 0%, transparent 60%), #05070d' }}>

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-[0_0_24px_rgba(212,146,10,0.4)] mb-5">
            <span className="text-dark-950 font-black text-xl">D</span>
          </div>
          <h1 className="text-white font-black text-xl tracking-widest uppercase">Dunamixfy</h1>
          <p className="text-primary-500/40 text-[10px] mt-1 font-semibold tracking-[0.22em] uppercase">WMS</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.08] p-6 shadow-2xl">

          {/* Header */}
          <div className="mb-5">
            {mode !== 'login' && (
              <button onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-4 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver
              </button>
            )}
            <h2 className="text-white font-bold text-base">
              {mode === 'login'    && 'Iniciar sesión'}
              {mode === 'register' && 'Crear cuenta'}
              {mode === 'forgot'   && 'Recuperar contraseña'}
            </h2>
            <p className="text-white/30 text-xs mt-0.5">
              {mode === 'login'    && 'Accede a tu espacio de trabajo'}
              {mode === 'register' && 'Crea tu cuenta en Dunamixfy WMS'}
              {mode === 'forgot'   && 'Te enviaremos un enlace de recuperación'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">

            {mode === 'register' && (
              <div>
                <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Nombre</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre completo" required
                    className={`${inputCls} pl-9`} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required
                  className={`${inputCls} pl-9`} />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-white/25 text-[11px] uppercase tracking-[0.12em] mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6}
                    className={`${inputCls} pl-9`} />
                </div>
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full bg-primary-500 hover:bg-primary-600 text-dark-950 font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1">
              {isLoading
                ? <div className="w-5 h-5 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" />
                : <>
                    <LogIn className="w-4 h-4" />
                    {mode === 'login'    && 'Iniciar sesión'}
                    {mode === 'register' && 'Crear cuenta'}
                    {mode === 'forgot'   && 'Enviar enlace'}
                  </>
              }
            </button>
          </form>

          {/* Links */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] text-center space-y-2">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('forgot')}
                  className="block w-full text-xs text-white/30 hover:text-white/60 transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
                <p className="text-xs text-white/30">
                  ¿Sin cuenta?{' '}
                  <button onClick={() => setMode('register')}
                    className="text-primary-400/80 hover:text-primary-400 font-semibold transition-colors">
                    Regístrate
                  </button>
                </p>
              </>
            )}
            {mode === 'register' && (
              <p className="text-xs text-white/30">
                ¿Ya tienes cuenta?{' '}
                <button onClick={() => setMode('login')}
                  className="text-primary-400/80 hover:text-primary-400 font-semibold transition-colors">
                  Inicia sesión
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-white/15 text-[10px] mt-6 tracking-widest uppercase">
          Dunamixfy WMS · Powered by Supabase
        </p>
      </div>
    </div>
  );
}

export default LoginAuth;
