export const CONTENT_TYPES = {
  reel_ig: { label: 'Reel Instagram', color: '#4ADE80' },
  historia_ig: { label: 'Historia Instagram', color: '#FBBF24' },
  video_youtube: { label: 'Video YouTube', color: '#5ECCFA' },
  tiktok: { label: 'TikTok', color: '#F87171' },
};

export const STAGES = ['Frío', 'Contactado', 'Llamada agendada', 'Realizada', 'Cliente', 'Perdido'];

export const STAGE_COLORS = {
  'Frío': '#7C878B',
  'Contactado': '#5ECCFA',
  'Llamada agendada': '#FBBF24',
  'Realizada': '#7FD9F7',
  'Cliente': '#4ADE80',
  'Perdido': '#F87171',
};

// table: nombre real de la tabla en Supabase
// Secciones que usan la tabla genérica CrmSection (formulario + tabla editable)
export const CRM_CONFIG = {
  referidos: {
    table: 'referrals',
    title: 'Recompensas por Referidos',
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'referrer', label: 'Cliente que refiere', type: 'text' },
      { key: 'referred', label: 'Persona referida', type: 'text' },
      { key: 'reward', label: 'Recompensa', type: 'text', placeholder: 'Ej. 1 mes gratis / 50€ dto.' },
      { key: 'status', label: 'Estado', type: 'select', options: ['Pendiente', 'Entregada'] },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
  },
};

// Bancos y trackers con UI propia (no usan la tabla genérica CrmSection)
export const CLIENT_STATUSES = ['Activo', 'Pausado', 'Finalizado'];
export const SCRIPT_STATUSES = ['Idea', 'Borrador', 'Listo', 'Grabado'];
export const SCRIPT_STATUS_COLORS = { 'Idea': '#7C878B', 'Borrador': '#5ECCFA', 'Listo': '#FBBF24', 'Grabado': '#4ADE80' };
export const DURATIONS = {
  'Mensual': 30,
  '3 meses': 90,
  '6 meses': 180,
  'Anual': 365,
  'Personalizada': null,
};
export const GOAL_METRICS = [
  { key: 'ventas', label: 'Nº de ventas' },
  { key: 'clientes_nuevos', label: 'Clientes nuevos' },
  { key: 'facturacion', label: 'Facturación (€)' },
  { key: 'inversion_ads', label: 'Inversión en ads (€)' },
  { key: 'clientes_activos_total', label: 'Clientes activos (total)' },
  { key: 'manual', label: 'Manual (lo actualizo yo)' },
];

export const PRODUCTION_STATUSES = {
  'Guion': { color: '#7C878B' },
  'Grabado': { color: '#5ECCFA' },
  'Editado': { color: '#FBBF24' },
  'Programado': { color: '#4ADE80' },
};

export const AD_OBJECTIVES = ['Visitas', 'Mensajes', 'Web', 'Interacción', 'Seguidores', 'Otro'];

// Convierte un objeto Date a "YYYY-MM-DD" usando la fecha LOCAL del
// navegador (no UTC). Antes se usaba d.toISOString(), que en España
// (por delante de UTC) desplazaba la fecha un día hacia atrás en el
// Calendario. Usa siempre esta función para fechas de calendario/tareas.
export const dateToISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Suma días a una fecha ISO (yyyy-mm-dd) y devuelve otra fecha ISO
export const addDaysISO = (dateISO, days) => {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateToISO(d);
};

export const NAV = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'calendario', label: 'Calendario', href: '/calendario' },
  { key: 'guiones', label: 'Guiones', href: '/guiones' },
  { key: 'videos', label: 'Vídeos', href: '/videos' },
  { key: 'plantillas', label: 'Plantillas de mensajes', href: '/plantillas' },
  { key: 'canal', label: 'Canal', href: '/canal' },
  { key: 'tareas', label: 'Tareas', href: '/tareas' },
  { key: 'equipo', label: 'Equipo', href: '/equipo' },
  { key: 'resumen', label: 'Resumen semanal', href: '/resumen' },
  { key: 'historial', label: 'Historial', href: '/historial' },
  { key: 'anuncios', label: 'Anuncios', href: '/anuncios' },
  { key: 'contactos', label: 'Contactos', href: '/contactos' },
  { key: 'clientes', label: 'Clientes activos', href: '/clientes' },
  { key: 'ventas', label: 'Ventas', href: '/ventas' },
  { key: 'referidos', label: 'Recompensas / Referidos', href: '/referidos' },
  { key: 'notas', label: 'Datos importantes', href: '/notas' },
  { key: 'documentos', label: 'Documentos', href: '/documentos' },
  { key: 'seguridad', label: 'Cuenta y Seguridad', href: '/seguridad' },
];

export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => dateToISO(new Date());
export const monthKey = (iso) => (iso || '').slice(0, 7);
export const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
export const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
