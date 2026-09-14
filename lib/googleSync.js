// Se llama después de crear/editar/borrar algo en el Calendario. Falla en
// silencio si Google no está configurado o el usuario no lo tiene conectado
// — la sincronización es opcional, nunca debe romper la acción principal.
export async function syncToGoogle(calendarEntryId, action = 'upsert') {
  try {
    await fetch('/api/google/sync-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarEntryId, action }),
    });
  } catch {
    // silencioso a propósito
  }
}

// Igual que arriba, pero para Tareas con hora (vista Semana) — se crean como
// eventos con hora real en Google, no de todo el día. Solo tiene efecto si
// la tarea tiene due_time puesto; sin hora, no hay nada que sincronizar.
export async function syncTaskToGoogle(taskId, action = 'upsert') {
  try {
    await fetch('/api/google/sync-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action }),
    });
  } catch {
    // silencioso a propósito
  }
}
