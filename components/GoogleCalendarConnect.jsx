'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck, CalendarX, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

export default function GoogleCalendarConnect() {
  const [connected, setConnected] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('var(--color-cyan)');
  const [syncing, setSyncing] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { data } = await supabase.from('google_calendar_connections').select('id').eq('user_id', userData.user.id).maybeSingle();
      setConnected(!!data);
    })();
  }, []);

  useEffect(() => {
    const g = searchParams.get('google');
    if (g === 'connected') {
      setMsg('¡Conectado! Lo que programes en el Calendario a partir de ahora se sincroniza solo. Si ya tenías cosas puestas antes de conectar, dale a "Sincronizar todo ahora" para empujarlas también.');
      setMsgColor('var(--color-green)');
      setConnected(true);
    } else if (g === 'error') {
      setMsg('No se pudo conectar. Inténtalo de nuevo.');
      setMsgColor('var(--color-red)');
    } else if (g === 'config') {
      setMsg('Google Calendar todavía no está configurado en el servidor (ver README).');
      setMsgColor('var(--color-amber)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const disconnect = async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('google_calendar_connections').delete().eq('user_id', userData.user.id);
    setConnected(false);
    setMsg('');
  };

  const syncAllNow = async () => {
    setSyncing(true);
    setMsg('');
    try {
      const supabase = createClient();
      const { data: entries } = await supabase.from('calendar_entries').select('id');
      const total = entries?.length || 0;
      let ok = 0;
      let firstError = null;
      for (const e of entries || []) {
        try {
          const res = await fetch('/api/google/sync-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ calendarEntryId: e.id, action: 'upsert' }),
          });
          const data = await res.json();
          if (data.synced > 0) ok++;
          else if (!firstError && data.error) firstError = data.error;
        } catch {
          // sigue con el siguiente
        }
      }
      if (ok === total && total > 0) {
        setMsg(`Sincronizados ${ok} de ${total} elementos con Google Calendar.`);
        setMsgColor('var(--color-green)');
      } else if (firstError) {
        setMsg(`Sincronizados ${ok} de ${total}. Google respondió con un error, ejemplo: ${firstError}`);
        setMsgColor('var(--color-red)');
      } else {
        setMsg(`Sincronizados ${ok} de ${total} elementos con Google Calendar.`);
        setMsgColor(total > 0 ? 'var(--color-amber)' : 'var(--color-muted)');
      }
    } catch {
      setMsg('No se pudo completar la sincronización. Inténtalo de nuevo.');
      setMsgColor('var(--color-red)');
    }
    setSyncing(false);
  };

  if (connected === null) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        {connected ? <CalendarCheck size={18} color="var(--color-green)" /> : <CalendarX size={18} className="text-muted" />}
        <span className="text-ink text-sm font-semibold">{connected ? 'Google Calendar conectado' : 'Google Calendar desconectado'}</span>
      </div>
      <div className="text-muted text-xs">
        Lo que se programe en el Calendario del panel (creación, edición o borrado) se sincroniza solo con tu Google
        Calendar. Cada cuenta conecta el suyo — es independiente de la de Ana.
      </div>
      {msg && <div className="text-xs" style={{ color: msgColor }}>{msg}</div>}
      <div className="flex items-center gap-2 flex-wrap">
        {connected ? (
          <>
            <button
              onClick={syncAllNow}
              disabled={syncing}
              className="rounded-lg px-4 py-2 font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'var(--color-cyan)', color: '#00161C' }}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando…' : 'Sincronizar todo ahora'}
            </button>
            <button
              onClick={disconnect}
              className="rounded-lg px-4 py-2 font-semibold text-sm w-fit"
              style={{ background: 'transparent', color: 'var(--color-red)', border: '1px solid var(--color-red)' }}
            >
              Desconectar
            </button>
          </>
        ) : (
          <a
            href="/api/google/connect"
            className="rounded-lg px-4 py-2 font-semibold text-sm w-fit inline-block"
            style={{ background: 'var(--color-cyan)', color: '#00161C' }}
          >
            Conectar Google Calendar
          </a>
        )}
      </div>
    </Card>
  );
}
