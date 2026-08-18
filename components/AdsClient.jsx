'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pause, Play, Users, TrendingUp, TrendingDown, Sparkles, Loader2, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { eur, todayISO, daysBetween, AD_OBJECTIVES } from '@/lib/config';

function computeSpend(ad) {
  const end = ad.status === 'Pausado' && ad.paused_at ? ad.paused_at : todayISO();
  const days = daysBetween(ad.start_date, end) + 1; // cuenta el día de inicio
  return days * (Number(ad.daily_amount) || 0);
}

export default function AdsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [ads, setAds] = useState([]);
  const [clientsByAd, setClientsByAd] = useState({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  const emptyForm = { campaign: '', start_date: todayISO(), daily_amount: '', objective: 'Visitas' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [adsRes, contactsRes] = await Promise.all([
      supabase.from('ad_spend').select('*').order('start_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('stage', 'Cliente').not('source_ad_id', 'is', null),
    ]);
    setAds(adsRes.data || []);
    const grouped = {};
    (contactsRes.data || []).forEach((c) => {
      if (!grouped[c.source_ad_id]) grouped[c.source_ad_id] = [];
      grouped[c.source_ad_id].push(c);
    });
    setClientsByAd(grouped);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('ads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_spend' }, load)
      .subscribe();
    const channel2 = supabase
      .channel('ads-contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(channel2); };
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

  const updatePerformance = async (ad, key, value) => {
    const patch = { [key]: value };
    const impressions = key === 'impressions' ? value : ad.impressions;
    const clicks = key === 'clicks' ? value : ad.clicks;
    if (key !== 'ctr' && impressions && clicks) {
      patch.ctr = ((Number(clicks) / Number(impressions)) * 100).toFixed(2);
    }
    setAds((a) => a.map((row) => (row.id === ad.id ? { ...row, ...patch } : row)));
    await supabase.from('ad_spend').update(patch).eq('id', ad.id);
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

  const analyzeWithAI = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysis('');
    try {
      const payload = ads.map((ad) => {
        const spend = computeSpend(ad);
        const attributedClients = clientsByAd[ad.id] || [];
        const attributedRevenue = attributedClients.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        const roi = spend > 0 ? Math.round(((attributedRevenue - spend) / spend) * 100) : null;
        return {
          campaign: ad.campaign,
          objective: ad.objective,
          status: ad.status,
          spend: spend.toFixed(0),
          attributedClients: attributedClients.length,
          attributedRevenue: attributedRevenue.toFixed(0),
          roi,
          impressions: ad.impressions || null,
          clicks: ad.clicks || null,
          ctr: ad.ctr || null,
        };
      });
      const res = await fetch('/api/assistant/analyze-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads: payload }),
      });
      const data = await res.json();
      if (!res.ok) setAnalysisError(data.error || 'Algo falló.');
      else setAnalysis(data.analysis);
    } catch {
      setAnalysisError('No se pudo conectar. Inténtalo de nuevo.');
    }
    setAnalyzing(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">ANUNCIOS</h2>
        <div className="text-muted text-xs">
          Pon la fecha de inicio y la inversión diaria — el gasto acumulado se calcula solo. Cuando un contacto de este
          anuncio pasa a Cliente en Contactos, verás aquí cuántos clientes y ROI real trae. Debajo de cada anuncio puedes
          copiar las impresiones/clics/CTR desde Meta Ads Manager de vez en cuando, para tener también el rendimiento real.
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

      {ads.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-cyan text-xs font-semibold">
              <Sparkles size={14} /> Análisis con IA (bajo demanda, no automático)
            </div>
            <button
              onClick={analyzeWithAI}
              disabled={analyzing}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
            >
              {analyzing ? <><Loader2 size={13} className="animate-spin" /> Analizando...</> : 'Analizar anuncios'}
            </button>
          </div>
          {analysisError && <div className="text-red text-xs">{analysisError}</div>}
          {analysis && <div className="text-ink text-sm whitespace-pre-wrap bg-surfaceAlt rounded-lg p-3 border border-border">{analysis}</div>}
        </Card>
      )}

      <Card className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:flex-wrap">
          <div className="w-full sm:flex-1 sm:min-w-[160px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Campaña</div>
            <input
              value={form.campaign}
              onChange={(e) => setForm({ ...form, campaign: e.target.value })}
              placeholder="Ej. Visitas perfil - Historias"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[130px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Objetivo</div>
            <select
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              {AD_OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Fecha de inicio</div>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[130px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Inversión diaria (€)</div>
            <input
              type="number"
              value={form.daily_amount}
              onChange={(e) => setForm({ ...form, daily_amount: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <button onClick={add} className="rounded-lg px-3 py-2 flex items-center justify-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0 w-full sm:w-auto">
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
          const attributedClients = clientsByAd[ad.id] || [];
          const attributedRevenue = attributedClients.reduce((s, c) => s + (Number(c.amount) || 0), 0);
          const roi = spend > 0 ? ((attributedRevenue - spend) / spend) * 100 : null;
          return (
            <Card key={ad.id} style={{ borderColor: active ? '#4ADE8055' : undefined }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <input
                    value={ad.campaign}
                    onChange={(e) => update(ad.id, 'campaign', e.target.value)}
                    className="bg-transparent text-ink font-bold text-sm outline-none w-full"
                  />
                  <div className="text-muted text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                    <select
                      value={ad.objective || 'Visitas'}
                      onChange={(e) => update(ad.id, 'objective', e.target.value)}
                      className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-cyan"
                    >
                      {AD_OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <span>· Desde {new Date(ad.start_date + 'T00:00:00').toLocaleDateString('es-ES')} ·</span>
                    <input
                      type="number"
                      value={ad.daily_amount}
                      onChange={(e) => update(ad.id, 'daily_amount', e.target.value)}
                      className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-0.5 text-xs w-16 outline-none focus:border-cyan"
                    />
                    <span>€/día</span>
                    {!active && ad.paused_at && <span>· pausado el {new Date(ad.paused_at + 'T00:00:00').toLocaleDateString('es-ES')}</span>}
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

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border flex-wrap">
                <div className="flex items-center gap-1.5 text-muted text-[11px] uppercase tracking-wide">
                  <Eye size={12} /> Rendimiento real (de Meta):
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={ad.impressions || ''}
                    onChange={(e) => updatePerformance(ad, 'impressions', e.target.value ? Number(e.target.value) : null)}
                    placeholder="0"
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-0.5 text-xs w-20 outline-none focus:border-cyan"
                  />
                  <span className="text-muted text-[10.5px]">impresiones</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={ad.clicks || ''}
                    onChange={(e) => updatePerformance(ad, 'clicks', e.target.value ? Number(e.target.value) : null)}
                    placeholder="0"
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-0.5 text-xs w-16 outline-none focus:border-cyan"
                  />
                  <span className="text-muted text-[10.5px]">clics</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={ad.ctr || ''}
                    onChange={(e) => updatePerformance(ad, 'ctr', e.target.value || null)}
                    placeholder="0.0"
                    step="0.01"
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-0.5 text-xs w-16 outline-none focus:border-cyan"
                  />
                  <span className="text-muted text-[10.5px]">% CTR</span>
                </div>
              </div>

              {attributedClients.length > 0 && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users size={14} className="text-cyan" />
                    <span className="text-ink font-semibold">{attributedClients.length}</span>
                    <span className="text-muted text-xs">cliente{attributedClients.length !== 1 ? 's' : ''} de este anuncio</span>
                  </div>
                  <div className="text-sm text-ink font-semibold">{eur(attributedRevenue)} facturado</div>
                  {roi !== null && (
                    <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: roi >= 0 ? '#4ADE80' : '#F87171' }}>
                      {roi >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      ROI {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
