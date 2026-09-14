'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';

export default function LoginClient() {
  const router  = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code,     setCode]     = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);

  // Si ya hay sesión activa, redirigir
  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/clientes');
      else setChecking(false);
    });
  }, []);

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setErr('Email o contraseña incorrectos.'); return; }
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') { setNeedsMfa(true); return; }
    router.replace('/clientes');
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const sb = createClient();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) { setLoading(false); setErr('No se encontró verificación en dos pasos.'); return; }
    const { data: challenge, error: challengeErr } = await sb.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr) { setLoading(false); setErr('Error al verificar.'); return; }
    const { error: verifyErr } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: code.trim() });
    setLoading(false);
    if (verifyErr) { setErr('Código incorrecto.'); return; }
    router.replace('/clientes');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-muted text-sm">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
              <Logo size={40} className="text-cyan" />
            </div>
          </div>
          <div className="font-display text-ink text-2xl tracking-wide">CHRIS FITNESS</div>
          <div className="text-violet text-[10px] tracking-[3px] uppercase mt-1">Panel de seguimiento</div>
        </div>

        {!needsMfa ? (
          <form onSubmit={submitPassword} className="space-y-3 rounded-xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <input type="email" required placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg px-3 py-2.5 w-full text-sm outline-none text-ink"
              style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }} />
            <input type="password" required placeholder="Contraseña"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg px-3 py-2.5 w-full text-sm outline-none text-ink"
              style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }} />
            {err && <div className="text-red text-xs">{err}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg py-2.5 font-bold text-sm disabled:opacity-60"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3 rounded-xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="text-ink text-sm font-semibold">Código de verificación</div>
            <div className="text-muted text-xs">Introduce el código de 6 dígitos de tu app autenticadora.</div>
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="000000" maxLength={6}
              className="rounded-lg px-3 py-2.5 w-full text-lg tracking-[0.3em] text-center outline-none text-ink"
              style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }} />
            {err && <div className="text-red text-xs">{err}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg py-2.5 font-bold text-sm disabled:opacity-60"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              {loading ? 'Verificando…' : 'Verificar y entrar'}
            </button>
          </form>
        )}

        <div className="text-muted text-[11px] text-center">Acceso privado — solo Chris Fitness</div>
      </div>
    </div>
  );
}
