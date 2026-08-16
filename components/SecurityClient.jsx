'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldOff, Trash2, User, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import PushNotifications from '@/components/PushNotifications';

function ProfileCard({ profile, onSaved }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [name, setName] = useState(profile?.display_name || '');
  const [role, setRole] = useState(profile?.role_title || '');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('profiles').update({ display_name: name.trim(), role_title: role.trim() }).eq('id', userData.user.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
    onSaved?.();
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 text-ink">
        <User size={18} />
        <span className="text-sm font-semibold">Tu perfil</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Nombre</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
          />
        </div>
        <div>
          <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Rol</div>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ej. Entrenador, Gestión"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
          />
        </div>
      </div>
      <button onClick={save} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C] flex items-center gap-1.5 w-fit">
        {saved ? <><Check size={15} /> Guardado</> : 'Guardar cambios'}
      </button>
    </Card>
  );
}

export default function SecurityClient({ profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEnroll = async () => {
    setErr('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      setErr('No se pudo iniciar la verificación. Inténtalo de nuevo.');
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirmEnroll = async () => {
    setErr('');
    if (!code.trim()) return;
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (challengeErr) {
      setErr('Error al verificar. Inténtalo de nuevo.');
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyErr) {
      setErr('Código incorrecto. Revisa la app autenticadora e inténtalo otra vez.');
      return;
    }
    setEnrolling(null);
    setCode('');
    loadFactors();
  };

  const cancelEnroll = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
    setCode('');
    setErr('');
  };

  const removeFactor = async (factorId) => {
    await supabase.auth.mfa.unenroll({ factorId });
    loadFactors();
  };

  const hasVerified = factors.some((f) => f.status === 'verified');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">CUENTA Y SEGURIDAD</h2>
        <div className="text-muted text-xs">
          Tu nombre y la verificación en dos pasos son solo tuyos — no afectan a la otra cuenta.
        </div>
      </div>

      <ProfileCard profile={profile} />

      <div className="border-t border-border pt-4">
        <div className="text-ink font-semibold text-sm mb-3">Notificaciones</div>
      </div>
      <PushNotifications />

      <div className="border-t border-border pt-4">
        <div className="text-ink font-semibold text-sm mb-3">Verificación en dos pasos</div>
      </div>

      {loading ? (
        <Card className="text-center py-8 text-muted">Cargando…</Card>
      ) : hasVerified && !enrolling ? (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-green">
            <ShieldCheck size={18} />
            <span className="text-sm font-semibold">Verificación en dos pasos activada</span>
          </div>
          <div className="text-muted text-xs">
            Cada vez que inicies sesión, se te pedirá también el código de tu app autenticadora.
          </div>
          {factors.filter((f) => f.status === 'verified').map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-surfaceAlt border border-border">
              <span className="text-ink text-xs">Añadida el {new Date(f.created_at).toLocaleDateString('es-ES')}</span>
              <button onClick={() => removeFactor(f.id)} className="text-red flex items-center gap-1 text-xs">
                <Trash2 size={13} /> Desactivar
              </button>
            </div>
          ))}
        </Card>
      ) : enrolling ? (
        <Card className="space-y-3">
          <div className="text-ink text-sm font-semibold">1. Escanea este código con tu app autenticadora</div>
          <div className="text-muted text-xs">Google Authenticator, Authy, 1Password... cualquiera vale.</div>
          <div
            className="bg-white rounded-lg p-3 w-fit"
            dangerouslySetInnerHTML={{ __html: enrolling.qr }}
          />
          <div className="text-muted text-[11px]">
            ¿No puedes escanear? Introduce esta clave manualmente: <span className="text-ink font-mono">{enrolling.secret}</span>
          </div>
          <div className="text-ink text-sm font-semibold pt-2">2. Introduce el código de 6 dígitos</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmEnroll()}
            placeholder="000000"
            maxLength={6}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-lg tracking-[0.3em] w-40 text-center outline-none focus:border-cyan"
          />
          {err && <div className="text-red text-xs">{err}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={confirmEnroll} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C]">
              Confirmar y activar
            </button>
            <button onClick={cancelEnroll} className="rounded-lg px-4 py-2 font-semibold text-sm text-muted">
              Cancelar
            </button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-muted">
            <ShieldOff size={18} />
            <span className="text-sm font-semibold">Verificación en dos pasos desactivada</span>
          </div>
          <div className="text-muted text-xs">
            Añade una capa extra: además de tu contraseña, se pedirá un código de tu app autenticadora al iniciar sesión.
          </div>
          {err && <div className="text-red text-xs">{err}</div>}
          <button onClick={startEnroll} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C] w-fit">
            Activar verificación en dos pasos
          </button>
        </Card>
      )}
    </div>
  );
}
