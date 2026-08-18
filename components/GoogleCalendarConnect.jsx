'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

export default function GoogleCalendarConnect() {
  const [connected, setConnected] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#5ECCFA');
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
      setMsg('¡Conectado! Lo que programes en el Calendario se sincroniza solo a partir de ahora.');
      setMsgColor('#4ADE80');
      setConnected(true);
    } else if (g === 'error') {
      setMsg('No se pudo conectar. Inténtalo de nuevo.');
      setMsgColor('#F87171');
    } else if (g === 'config') {
      setMsg('Google Calendar todavía no está configurado en el servidor (ver README).');
      setMsgColor('#FBBF24');
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

  if (connected === null) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        {connected ? <CalendarCheck size={18} color="#4ADE80" /> : <CalendarX size={18} className="text-muted" />}
        <span className="text-ink text-sm font-semibold">{connected ? 'Google Calendar conectado' : 'Google Calendar desconectado'}</span>
      </div>
      <div className="text-muted text-xs">
        Lo que se programe en el Calendario del panel (creación, edición o borrado) se sincroniza solo con tu Google
        Calendar. Cada cuenta conecta el suyo — es independiente de la de Ana.
      </div>
      {msg && <div className="text-xs" style={{ color: msgColor }}>{msg}</div>}
      {connected ? (
        <button
          onClick={disconnect}
          className="rounded-lg px-4 py-2 font-semibold text-sm w-fit"
          style={{ background: 'transparent', color: '#F87171', border: '1px solid #F87171' }}
        >
          Desconectar
        </button>
      ) : (
        <a
          href="/api/google/connect"
          className="rounded-lg px-4 py-2 font-semibold text-sm w-fit inline-block"
          style={{ background: '#5ECCFA', color: '#00161C' }}
        >
          Conectar Google Calendar
        </a>
      )}
    </Card>
  );
}
