// Lógica de la periodización (Timeline) — compartida por el componente.
// Cada fase tiene su propio ritmo semanal (%); una semana usa el ritmo de
// la fase a la que pertenece según su fecha. Editar el objetivo de una
// semana recalcula todas las siguientes en cadena; las anteriores nunca
// se tocan.

export function phaseForDate(phases, dateISO) {
  return (phases || []).find((p) => dateISO >= p.start_date && dateISO <= p.end_date) || null;
}

export function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

// Genera N semanas desde una fecha de inicio, calculando el objetivo en
// cadena con el ritmo de la fase de cada semana.
export function generateWeeks(phases, startDate, weeksCount, startWeight) {
  const weeks = [];
  let prevTarget = startWeight;
  let start = mondayOf(startDate);
  for (let i = 0; i < weeksCount; i++) {
    const week_start = addDaysISO(start, i * 7);
    const ph = phaseForDate(phases, week_start);
    const rate = ph?.rate ?? 0;
    const target = i === 0 ? prevTarget : prevTarget * (1 + rate / 100);
    weeks.push({
      week_start,
      kcal: ph?.kcal ?? null,
      target_weight: Math.round(target * 10) / 10,
      target_overridden: false,
      real_weight: null,
    });
    prevTarget = target;
  }
  return weeks;
}

// Recalcula hacia adelante desde la semana editada (por índice), usando el
// ritmo de la fase de cada semana siguiente. Devuelve solo las filas que
// cambiaron (la editada + las posteriores), para guardar en un solo golpe.
export function recalcFrom(weeks, phases, editedIndex, newTarget) {
  const next = weeks.map((w) => ({ ...w }));
  next[editedIndex].target_weight = Math.round(newTarget * 10) / 10;
  next[editedIndex].target_overridden = true;
  let prev = next[editedIndex].target_weight;
  for (let i = editedIndex + 1; i < next.length; i++) {
    const ph = phaseForDate(phases, next[i].week_start);
    const rate = ph?.rate ?? 0;
    const val = Math.round(prev * (1 + rate / 100) * 10) / 10;
    next[i] = { ...next[i], target_weight: val, target_overridden: false };
    prev = val;
  }
  return next.slice(editedIndex);
}

export function monthKeyOf(dateISO) {
  return dateISO.slice(0, 7);
}
