'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotifications() {
  const [status, setStatus] = useState('checking'); // checking | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? 'on' : 'off');
      } catch {
        setStatus('off');
      }
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    setErr('');
    try {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setErr('Falta configurar la clave VAPID en el servidor (ver README).');
        setBusy(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('push_subscriptions').upsert(
        { user_id: userData.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: 'endpoint' }
      );
      setStatus('on');
    } catch (e) {
      console.error(e);
      setErr('No se pudo activar. Inténtalo de nuevo.');
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const supabase = createClient();
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  if (status === 'checking') return null;

  if (status === 'unsupported') {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2 text-muted"><BellOff size={18} /><span className="text-sm font-semibold">Notificaciones no disponibles aquí</span></div>
        <div className="text-muted text-xs">
          En iPhone hace falta instalar el panel en la pantalla de inicio primero (Safari → compartir → "Añadir a pantalla de inicio") y abrirlo desde ese icono, no desde el navegador.
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        {status === 'on' ? <Bell size={18} color="#4ADE80" /> : <BellOff size={18} className="text-muted" />}
        <span className="text-ink text-sm font-semibold">
          {status === 'on' ? 'Notificaciones activadas' : status === 'denied' ? 'Notificaciones bloqueadas' : 'Notificaciones desactivadas'}
        </span>
      </div>
      <div className="text-muted text-xs">
        Un aviso al día (sobre las 9:00) con tus tareas de los próximos 3-4 días — solo las tuyas. Ana no ve las tuyas ni tú las suyas por aquí, cada cuenta activa la suya.
      </div>
      {status === 'denied' && (
        <div className="text-amber text-xs">
          Las bloqueaste antes. Actívalas desde los ajustes de notificaciones de tu navegador o de la app instalada, y recarga esta página.
        </div>
      )}
      {err && <div className="text-red text-xs">{err}</div>}
      {status !== 'denied' && (
        <button
          onClick={status === 'on' ? disable : enable}
          disabled={busy}
          className="rounded-lg px-4 py-2 font-semibold text-sm w-fit disabled:opacity-60"
          style={
            status === 'on'
              ? { background: 'transparent', color: '#F87171', border: '1px solid #F87171' }
              : { background: '#5ECCFA', color: '#00161C' }
          }
        >
          {busy ? 'Un momento…' : status === 'on' ? 'Desactivar' : 'Activar notificaciones'}
        </button>
      )}
    </Card>
  );
}
