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
  'Mensual': 1,
  '3 meses': 3,
  '6 meses': 6,
  'Anual': 12,
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

// Suma MESES de calendario de verdad (no una aproximación en días) — si
// pagas el 20/1, con 3 meses renueva el 20/4, el mismo día siempre. Si el
// mes de destino no tiene ese día (ej. 31 de enero + 1 mes), se ajusta al
// último día real de ese mes (28/29 de febrero) en vez de desbordar a marzo.
export const addMonthsISO = (dateISO, months) => {
  const d = new Date(dateISO + 'T00:00:00');
  const targetMonthIndex = d.getMonth() + months;
  const result = new Date(d.getFullYear(), targetMonthIndex, d.getDate());
  const expectedMonth = ((targetMonthIndex % 12) + 12) % 12;
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0); // se desbordó (ej. 31 en un mes de 30) — vuelve al último día del mes correcto
  }
  return dateToISO(result);
};

// Menú organizado por niveles (como un panel de empresa): cada grupo es una
// área del negocio. El sidebar pinta la cabecera del grupo y sus secciones
// debajo; si un grupo se queda vacío (p. ej. Dinero para quien no es dueño),
// no se muestra.
// El panel es un manager de redes: contenido, leads y anuncios. Facturación,
// Ventas y Clientes activos están ocultas del menú (`hidden: true`), pero sus
// páginas y datos siguen existiendo: para volver a mostrarlas basta con
// quitar `hidden`.
export const NAV_GROUPS = [
  {
    key: 'inicio',
    label: 'Inicio',
    items: [
      { key: 'dashboard', label: 'Hoy', href: '/dashboard' },
      { key: 'tareas', label: 'Tareas', href: '/tareas' },
      { key: 'resumen', label: 'Resumen semanal', href: '/resumen' },
      { key: 'historial', label: 'Historial / KPIs', href: '/historial' },
    ],
  },
  {
    key: 'contenido',
    label: 'Contenido',
    items: [
      { key: 'contenido', label: 'Calendario de contenido', href: '/contenido' },
      { key: 'calendario', label: 'Agenda día / semana', href: '/calendario' },
      { key: 'guiones', label: 'Ideas y guiones', href: '/guiones' },
      { key: 'videos', label: 'Vídeos', href: '/videos' },
    ],
  },
  {
    key: 'captacion',
    label: 'Leads y anuncios',
    items: [
      { key: 'contactos', label: 'Leads', href: '/contactos' },
      { key: 'anuncios', label: 'Anuncios', href: '/anuncios' },
      { key: 'plantillas', label: 'Plantillas de mensajes', href: '/plantillas' },
      { key: 'referidos', label: 'Referidos', href: '/referidos' },
    ],
  },
  {
    key: 'negocio',
    label: 'Negocio',
    items: [
      { key: 'ventas', label: 'Ventas', href: '/ventas', hidden: true },
      { key: 'clientes', label: 'Clientes activos', href: '/clientes', hidden: true },
      { key: 'facturacion', label: 'Facturación', href: '/facturacion', ownerOnly: true, hidden: true },
    ],
  },
  {
    key: 'equipo',
    label: 'Equipo',
    items: [
      { key: 'equipo', label: 'Equipo', href: '/equipo' },
      { key: 'canal', label: 'Canal', href: '/canal' },
    ],
  },
  {
    key: 'documentos',
    label: 'Documentos',
    items: [
      { key: 'notas', label: 'Datos importantes', href: '/notas' },
      { key: 'documentos', label: 'Documentos', href: '/documentos' },
    ],
  },
  {
    key: 'cuenta',
    label: 'Cuenta',
    items: [
      { key: 'seguridad', label: 'Cuenta y Seguridad', href: '/seguridad' },
    ],
  },
];

// Lista plana (por si algún sitio necesita todas las secciones sin grupos)
export const NAV = NAV_GROUPS.flatMap((g) => g.items);

// ---------------------------------------------------------------------------
// CALENDARIO DE CONTENIDO
// ---------------------------------------------------------------------------
// Estado de publicación de cada pieza. Hoy se marca a mano; cuando se
// conecten Instagram/YouTube lo rellenará la sincronización.
export const PUBLISH_STATUSES = {
  publicado: { label: 'Publicado', color: '#4ADE80' },
  programado: { label: 'Programado', color: '#5ECCFA' },
  borrador: { label: 'Borrador', color: '#FBBF24' },
  error: { label: 'Error', color: '#F87171' },
};

// Estado de publicación de una entrada del calendario: si está guardado
// explícitamente se usa ese; si no, se deduce de lo que ya existía (marcado
// como hecho, o vídeo vinculado subido / Programado).
export const publishStatusOf = (entry, video) => {
  if (entry.publish_status && PUBLISH_STATUSES[entry.publish_status]) return entry.publish_status;
  if (entry.status === 'hecho' || video?.uploaded) return 'publicado';
  if (video?.production_status === 'Programado') return 'programado';
  return 'borrador';
};

export const PLATFORMS = {
  instagram: { label: 'Instagram' },
  tiktok: { label: 'TikTok' },
  youtube: { label: 'YouTube' },
  otro: { label: 'Otros' },
};

// Deduce la plataforma a partir de la categoría de contenido (las
// categorías son editables, así que se mira el id y el nombre).
export const platformOf = (categoryId, categoryLabel = '') => {
  const s = `${categoryId || ''} ${categoryLabel || ''}`.toLowerCase();
  if (s.includes('youtube') || s.includes('_yt')) return 'youtube';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('_ig') || s.includes('instagram') || s.includes('reel') || s.includes('historia')) return 'instagram';
  return 'otro';
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => dateToISO(new Date());
export const monthKey = (iso) => (iso || '').slice(0, 7);
export const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
export const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
