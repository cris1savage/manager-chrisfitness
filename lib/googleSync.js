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
