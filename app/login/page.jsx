'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setErr('Email o contraseña incorrectos.');
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      setNeedsMfa(true);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) {
      setLoading(false);
      setErr('No se encontró la verificación en dos pasos de esta cuenta.');
      return;
    }
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr) {
      setLoading(false);
      setErr('Error al verificar. Inténtalo de nuevo.');
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setLoading(false);
    if (verifyErr) {
      setErr('Código incorrecto. Revisa la app autenticadora.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <div className="font-display text-ink text-[32px] tracking-wide">CHRIS FITNESS</div>
          <div className="text-cyan text-xs tracking-[2px]">PANEL DE CONTROL</div>
        </div>

        {!needsMfa ? (
          <form onSubmit={submitPassword} className="space-y-3 bg-surface border border-border rounded-xl p-4">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-cyan"
            />
            <input
              type="password"
              required
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-cyan"
            />
            {err && <div className="text-red text-xs">{err}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 font-bold bg-cyan text-[#00161C] disabled:opacity-60"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3 bg-surface border border-border rounded-xl p-4">
            <div className="text-ink text-sm font-semibold">Código de verificación</div>
            <div className="text-muted text-xs">Abre tu app autenticadora e introduce el código de 6 dígitos.</div>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 w-full text-lg tracking-[0.3em] text-center outline-none focus:border-cyan"
            />
            {err && <div className="text-red text-xs">{err}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 font-bold bg-cyan text-[#00161C] disabled:opacity-60"
            >
              {loading ? 'Verificando…' : 'Verificar y entrar'}
            </button>
          </form>
        )}

        <div className="text-muted text-[11px] text-center">
          Las cuentas se crean desde Supabase (no hay registro público). Habla con Chris si necesitas acceso.
        </div>
      </div>
    </div>
  );
}
