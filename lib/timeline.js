// ─── Utilidades de fecha ───────────────────────────────────────────────────

export function phaseForDate(phases, dateISO) {
  return (phases || []).find((p) => dateISO >= p.start_date && dateISO <= p.end_date) || null;
}

export function addDaysISO(dateISO, days) {
  const d = new Date(dateISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateISO) {
  const d = new Date(dateISO + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=dom, 1=lun ... 6=sab
  const diff = dow === 0 ? 6 : dow - 1; // pasos atrás hasta el lunes
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKeyOf(dateISO) {
  return dateISO.slice(0, 7);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [, mm, dd] = iso.split('-');
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1]}`;
}

export function monthLabelFull(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

// ─── Semanas reales del calendario ────────────────────────────────────────
// Devuelve TODAS las semanas lun-dom que contienen al menos 1 día del mes ym
export function realWeeksOfMonth(ym) {
  const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [y, m] = ym.split('-').map(Number);
  const pad     = (n) => String(n).padStart(2, '0');
  const firstISO = `${y}-${pad(m)}-01`;
  const lastISO  = `${y}-${pad(m)}-${daysInMonth(ym)}`;

  // Lunes que contiene o precede al primer día del mes
  const startMonday = mondayOf(firstISO);

  const weeks = [];
  let cur = startMonday;

  while (cur <= lastISO) {
    const wEnd = addDaysISO(cur, 6);

    // Solo incluir si la semana tiene al menos 1 día dentro del mes
    const overlaps = cur <= lastISO && wEnd >= firstISO;
    if (overlaps) {
      // Días visibles del mes en esta semana
      const visStart = cur < firstISO ? firstISO : cur;
      const visEnd   = wEnd > lastISO ? lastISO : wEnd;
      const sd = parseInt(visStart.split('-')[2]);
      const ed = parseInt(visEnd.split('-')[2]);
      const ml = MONTHS_SHORT[m - 1];

      // Etiqueta corta: "14-20 sep" o "...6 sep" o "28 sep..."
      let shortLabel;
      if (cur < firstISO)   shortLabel = `...${ed} ${ml}`;
      else if (wEnd > lastISO) shortLabel = `${sd} ${ml}...`;
      else                   shortLabel = `${sd}-${ed} ${ml}`;

      weeks.push({
        weekStart:  cur,      // lunes real — siempre primer día de la semana
        weekEnd:    wEnd,     // domingo real
        label:      `Semana del ${shortLabel}`,
        shortLabel,
        idx: weeks.length,
      });
    }

    cur = addDaysISO(cur, 7);
  }

  return weeks;
}

// Devuelve la semana real que contiene una fecha ISO
export function weekOfDate(dateISO) {
  const wStart = mondayOf(dateISO);
  const wEnd   = addDaysISO(wStart, 6);
  return { weekStart: wStart, weekEnd: wEnd };
}

// Retrocompatibilidad: etiqueta fija para el MesClient antiguo
export function weekRangeLabel(ym, weekIdx) {
  const weeks = realWeeksOfMonth(ym);
  return weeks[weekIdx] ? `Semana del ${weeks[weekIdx].shortLabel}` : `Semana ${weekIdx + 1}`;
}

// ─── Timeline / peso ──────────────────────────────────────────────────────

export function generateWeeks(phases, startDate, weeksCount, startWeight) {
  const weeks = [];
  let prevTarget = startWeight;
  const start = mondayOf(startDate);
  for (let i = 0; i < weeksCount; i++) {
    const week_start = addDaysISO(start, i * 7);
    const ph   = phaseForDate(phases, week_start);
    const rate = ph?.rate ?? 0;
    const target = i === 0 ? prevTarget : prevTarget * (1 + rate / 100);
    weeks.push({
      week_start,
      kcal: ph?.kcal ?? null,
      kcal_on: null,
      kcal_off: null,
      target_weight: Math.round(target * 10) / 10,
      target_overridden: false,
      real_weight: null,
    });
    prevTarget = target;
  }
  return weeks;
}

export function recalcFrom(weeks, phases, editedIndex, newTarget) {
  const next = weeks.map((w) => ({ ...w }));
  next[editedIndex].target_weight = Math.round(newTarget * 10) / 10;
  next[editedIndex].target_overridden = true;
  let prev = next[editedIndex].target_weight;
  for (let i = editedIndex + 1; i < next.length; i++) {
    const ph   = phaseForDate(phases, next[i].week_start);
    const rate = ph?.rate ?? 0;
    next[i] = {
      ...next[i],
      target_weight: Math.round(prev * (1 + rate / 100) * 10) / 10,
      target_overridden: false,
    };
    prev = next[i].target_weight;
  }
  return next.slice(editedIndex);
}

// ─── Kcal media ponderada ─────────────────────────────────────────────────
// (kcal_on × dias_on + kcal_off × dias_off) / 7
export function calcKcalMedia(kcal_on, kcal_off, dias_on) {
  const on  = Number(kcal_on)  || 0;
  const off = Number(kcal_off) || 0;
  const don = Math.min(Number(dias_on) || 0, 7);
  const dof = 7 - don;
  if (!on && !off) return null;
  if (!off || !dof) return on || null;
  if (!on || !don) return off || null;
  return Math.round((on * don + off * dof) / 7);
}

// Macros → kcal: P×4 + C×4 + G×9
export function calcKcalFromMacros(protein, carbs, fat) {
  const p = Number(protein) || 0;
  const c = Number(carbs)   || 0;
  const g = Number(fat)     || 0;
  if (!p && !c && !g) return null;
  return Math.round(p * 4 + c * 4 + g * 9);
}

// ─── Medias mensuales ─────────────────────────────────────────────────────

export function avgWeeklyField(weeklyNotes, field) {
  const vals = (weeklyNotes || []).map((w) => w[field]).filter((v) => v != null && v !== '');
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) / 10;
}

export function avgKcalForMonth(weeks, ym) {
  const inMonth = (weeks || []).filter((w) => w.week_start && w.week_start.slice(0, 7) === ym);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const onVals  = inMonth.map((w) => w.kcal_on ?? w.kcal).filter((v) => v != null);
  const offVals = inMonth.map((w) => w.kcal_off).filter((v) => v != null);
  return { on: avg(onVals), off: avg(offVals), weeksCount: inMonth.length };
}

// ─── Notas semanales por defecto (semanas reales del mes) ─────────────────
export function defaultWeeklyNotes(month) {
  const weeks = realWeeksOfMonth(month);
  return weeks.map((w) => ({
    weekStart:  w.weekStart,
    weekEnd:    w.weekEnd,
    label:      w.label,
    note: '', strength: null,
    steps: null, steps_goal: null,
    kcal_on: null, kcal_off: null, dias_on: null,
    protein_on: null, carbs_on: null, fat_on: null,
    protein_off: null, carbs_off: null, fat_off: null,
    adherence: null,
    days: Array(7).fill(null).map(() => ({ weight: null, steps: null, trained: null, diet: null })),
    saved: false,
  }));
}

// ─── Constantes ───────────────────────────────────────────────────────────

export function phaseColor(phases, name) {
  const COLORS = {
    Volumen:       '#5ECCFA',
    Definición:    '#FBBF24',
    Mantenimiento: '#A78BFA',
    Recomposición: '#4ADE80',
    Otra:          '#7C878B',
  };
  return COLORS[name] || '#7C878B';
}

export const PHASE_NAMES    = ['Volumen','Definición','Mantenimiento','Recomposición','Otra'];
export const MEASUREMENTS   = ['Cuello','Hombros','Pecho','Bíceps izq','Bíceps der','Antebrazo izq','Antebrazo der','Cintura','Cadera','Muslo izq','Muslo der','Gemelo izq','Gemelo der'];
export const WEEK_STRENGTHS = ['Fuerte','Normal','Floja'];
export const STRENGTH_COLOR = { Fuerte: '#4ADE80', Normal: '#FBBF24', Floja: '#F87171' };
export const GOAL_STATUSES  = ['Cumplido','Parcial','No cumplido','Pendiente'];
export const GOAL_COLORS    = { Cumplido: '#4ADE80', Parcial: '#FBBF24', 'No cumplido': '#F87171', Pendiente: '#7C878B' };
export const LEVEL_OPTIONS  = ['Excelente','Buena','Regular','Mala'];
export const LEVEL_COLORS   = { Excelente: '#4ADE80', Buena: '#5ECCFA', Regular: '#FBBF24', Mala: '#F87171' };

export function readToken(clienteId) {
  const raw = clienteId.replace(/-/g, '');
  return raw.slice(0, 8) + raw.slice(-4);
}
