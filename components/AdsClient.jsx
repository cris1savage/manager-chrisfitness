'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pause, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { eur, todayISO, daysBetween } from '@/lib/config';

function computeSpend(ad) {
  const end = ad.status === 'Pausado' && ad.paused_at ? ad.paused_at : todayISO();
  const days = daysBetween(ad.start_date, end) + 1; // cuenta el día de inicio
  return days * (Number(ad.daily_amount) || 0);
}

export default function AdsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const emptyForm = { campaign: '', start_date: todayISO(), daily_amount: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await supabase.from('ad_spend').select('*').order('start_date', { ascending: false });
    setAds(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('ads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_spend' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!form.campaign.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('ad_spend').insert({ ...form, status: 'Activo', created_by: userData.user.id });
    setForm(emptyForm);
    load();
  };

  const update = async (id, key, value) => {
    setAds((a) => a.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    await supabase.from('ad_spend').update({ [key]: value }).eq('id', id);
  };

  const togglePause = async (ad) => {
    if (ad.status === 'Activo') {
      await supabase.from('ad_spend').update({ status: 'Pausado', paused_at: todayISO() }).eq('id', ad.id);
    } else {
      await supabase.from('ad_spend').update({ status: 'Activo', paused_at: null }).eq('id', ad.id);
    }
    load();
  };

  const remove = async (id) => {
    setAds((a) => a.filter((row) => row.id !== id));
    await supabase.from('ad_spend').delete().eq('id', id);
  };

  const totalSpend = ads.reduce((s, ad) => s + computeSpend(ad), 0);
  const activeSpendDaily = ads.filter((a) => a.status === 'Activo').reduce((s, a) => s + (Number(a.daily_amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">ANUNCIOS</h2>
        <div className="text-muted text-xs">
          Pon la fecha de inicio y la inversión diaria — el gasto acumulado se calcula solo. Pausa el anuncio cuando lo apagues para que deje de sumar.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-muted text-[11px] uppercase tracking-wide">Gasto acumulado total</div>
          <div className="text-ink text-xl font-extrabold font-display">{eur(totalSpend)}</div>
        </Card>
        <Card>
          <div className="text-muted text-[11px] uppercase tracking-wide">Ritmo diario activo</div>
          <div className="text-ink text-xl font-extrabold font-display">{eur(activeSpendDaily)}/día</div>
        </Card>
      </div>

      <Card className="!p-0 overflow-x-auto">
        <div className="grid gap-2 items-end p-4" style={{ gridTemplateColumns: 'minmax(160px,1fr) minmax(130px,1fr) minmax(130px,1fr) auto', minWidth: 560 }}>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Campaña</div>
            <input
              value={form.campaign}
              onChange={(e) => setForm({ ...form, campaign: e.target.value })}
              placeholder="Ej. Visitas perfil - Historias"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Fecha de inicio</div>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Inversión diaria (€)</div>
            <input
              type="number"
              value={form.daily_amount}
              onChange={(e) => setForm({ ...form, daily_amount: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <button onClick={add} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0">
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      <div className="space-y-2">
        {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
        {!loading && ads.length === 0 && <Card className="text-center py-8 text-muted">Todavía no hay anuncios registrados.</Card>}
        {ads.map((ad) => {
          const spend = computeSpend(ad);
          const active = ad.status === 'Activo';
          return (
            <Card key={ad.id} style={{ borderColor: active ? '#4ADE8055' : undefined }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <input
                    value={ad.campaign}
                    onChange={(e) => update(ad.id, 'campaign', e.target.value)}
                    className="bg-transparent text-ink font-bold text-sm outline-none w-full"
                  />
                  <div className="text-muted text-xs mt-1">
                    Desde {new Date(ad.start_date + 'T00:00:00').toLocaleDateString('es-ES')} ·{' '}
                    <input
                      type="number"
                      value={ad.daily_amount}
                      onChange={(e) => update(ad.id, 'daily_amount', e.target.value)}
                      className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-0.5 text-xs w-16 outline-none focus:border-cyan"
                    />{' '}
                    €/día
                    {!active && ad.paused_at && ` · pausado el ${new Date(ad.paused_at + 'T00:00:00').toLocaleDateString('es-ES')}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-cyan font-display text-lg">{eur(spend)}</div>
                    <span
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                      style={{ background: active ? '#4ADE8022' : '#7C878B22', color: active ? '#4ADE80' : '#7C878B' }}
                    >
                      {ad.status}
                    </span>
                  </div>
                  <AuthorBadge profile={profiles?.[ad.created_by]} />
                  <button
                    onClick={() => togglePause(ad)}
                    className="p-2 rounded-lg"
                    style={{ color: active ? '#FBBF24' : '#4ADE80' }}
                    title={active ? 'Pausar' : 'Reactivar'}
                  >
                    {active ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button onClick={() => remove(ad.id)} className="p-2 rounded-lg text-red">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
