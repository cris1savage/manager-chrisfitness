export const CONTENT_TYPES = {
  video: { label: 'Video', color: '#5ECCFA' },
  reel: { label: 'Reel', color: '#4ADE80' },
  historia: { label: 'Historia', color: '#FBBF24' },
};

// table: nombre real de la tabla en Supabase
export const CRM_CONFIG = {
  anuncios: {
    table: 'ad_spend',
    title: 'Inversión en Anuncios',
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'campaign', label: 'Campaña', type: 'text', placeholder: 'Ej. Visitas perfil - Historias' },
      { key: 'amount', label: 'Importe', type: 'number' },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
    amountField: 'amount',
  },
  leads: {
    table: 'leads',
    title: 'Leads',
    comments: true,
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'name', label: 'Nombre / @usuario', type: 'text' },
      { key: 'source', label: 'Origen', type: 'select', options: ['Instagram', 'Referido', 'TusMacros', 'Otro'] },
      { key: 'status', label: 'Estado', type: 'select', options: ['Nuevo', 'Contactado', 'Descartado'] },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
  },
  conversaciones: {
    table: 'conversations',
    title: 'Conversaciones Iniciadas',
    comments: true,
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'name', label: 'Nombre / @usuario', type: 'text' },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
  },
  invitaciones: {
    table: 'invites',
    title: 'Invitación a Videollamada',
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'name', label: 'Nombre / @usuario', type: 'text' },
      { key: 'status', label: 'Estado', type: 'select', options: ['Pendiente', 'Aceptada', 'Rechazada'] },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
  },
  videollamadas: {
    table: 'calls',
    title: 'Videollamadas Realizadas',
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'name', label: 'Nombre / @usuario', type: 'text' },
      { key: 'result', label: 'Resultado', type: 'select', options: ['Positiva', 'Neutral', 'Negativa'] },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
  },
  ventas: {
    table: 'sales',
    title: 'Ventas Cerradas',
    fields: [
      { key: 'date', label: 'Fecha', type: 'date' },
      { key: 'name', label: 'Cliente', type: 'text' },
      { key: 'program', label: 'Programa', type: 'text', placeholder: 'Ej. Coaching 3 meses' },
      { key: 'amount', label: 'Importe', type: 'number' },
      { key: 'notes', label: 'Notas', type: 'text' },
    ],
    amountField: 'amount',
  },
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
export const IDEA_TYPES = ['reel', 'video', 'historia'];
export const CLIENT_STATUSES = ['Activo', 'Pausado', 'Finalizado'];

export const NAV = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'calendario', label: 'Calendario', href: '/calendario' },
  { key: 'ideas', label: 'Banco de ideas', href: '/ideas' },
  { key: 'tareas', label: 'Tareas', href: '/tareas' },
  { key: 'anuncios', label: 'Anuncios', href: '/anuncios' },
  { key: 'leads', label: 'Leads', href: '/leads' },
  { key: 'conversaciones', label: 'Conversaciones', href: '/conversaciones' },
  { key: 'invitaciones', label: 'Invitaciones', href: '/invitaciones' },
  { key: 'videollamadas', label: 'Videollamadas', href: '/videollamadas' },
  { key: 'clientes', label: 'Clientes activos', href: '/clientes' },
  { key: 'ventas', label: 'Ventas', href: '/ventas' },
  { key: 'referidos', label: 'Recompensas / Referidos', href: '/referidos' },
  { key: 'notas', label: 'Datos importantes', href: '/notas' },
  { key: 'seguridad', label: 'Seguridad', href: '/seguridad' },
];

export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthKey = (iso) => (iso || '').slice(0, 7);
export const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
