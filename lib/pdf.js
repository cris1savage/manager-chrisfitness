// Generación de PDF de informe mensual — Chris Fitness
// Reutilizado del manager, adaptado para cf-clientes

import { monthLabelFull, GOAL_STATUSES } from '@/lib/timeline';

function drawProgressRing(doc, cx, cy, r, pct, rgb) {
  doc.setLineWidth(2.6);
  doc.setDrawColor(228, 228, 228);
  doc.circle(cx, cy, r, 'S');
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const totalSteps = 72;
  const activeSteps = Math.round(pct * totalSteps);
  for (let i = 0; i < activeSteps; i++) {
    const a1 = (-90 + (360 * i) / totalSteps) * (Math.PI / 180);
    const a2 = (-90 + (360 * (i + 1)) / totalSteps) * (Math.PI / 180);
    doc.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
  }
}

function drawLineChartPDF(doc, x, y, w, h, points, colorRGB) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const yMin = min - pad;
  const yMax = max + pad;

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 3; i++) {
    const gy = y + (h * i) / 3;
    doc.line(x, gy, x + w, gy);
  }

  const px = (i) => x + (w * i) / Math.max(1, points.length - 1);
  const py = (v) => y + h - ((v - yMin) / (yMax - yMin)) * h;

  doc.setDrawColor(colorRGB[0], colorRGB[1], colorRGB[2]);
  doc.setLineWidth(0.7);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(px(i), py(points[i].value), px(i + 1), py(points[i + 1].value));
  }
  doc.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
  points.forEach((p, i) => doc.circle(px(i), py(p.value), 1.1, 'F'));

  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'normal');
  points.forEach((p, i) => doc.text(p.label, px(i), y + h + 6, { align: 'center' }));
  doc.text(yMax.toFixed(0), x - 3, y + 2, { align: 'right' });
  doc.text(yMin.toFixed(0), x - 3, y + h, { align: 'right' });
}

export async function downloadCheckinPDF(client, checkin, allCheckins = []) {
  const { jsPDF } = await import('jspdf');
  const doc       = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX   = 14;
  const maxX      = pageWidth - marginX;

  // Header oscuro
  doc.setFillColor(5, 7, 8);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setTextColor(94, 204, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CHRIS FITNESS', 14, 20);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text('INFORME DE SEGUIMIENTO MENSUAL', 14, 27);

  // Nombre y mes
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(client.name, marginX, 52);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`${monthLabelFull(checkin.month)} · Fase: ${checkin.phase || '—'}`, marginX, 59);

  // Anillo de semanas fuertes
  const weeklyNotes = checkin.weekly_notes?.length ? checkin.weekly_notes : [];
  const ratedWeeks  = weeklyNotes.filter((w) => w.strength);
  if (ratedWeeks.length) {
    const strongPct = ratedWeeks.filter((w) => w.strength === 'Fuerte').length / ratedWeeks.length;
    const ringColor = strongPct >= 0.6 ? [22, 163, 74] : strongPct >= 0.3 ? [180, 83, 9] : [220, 38, 38];
    const cx = maxX - 12;
    const cy = 46;
    drawProgressRing(doc, cx, cy, 11, strongPct, ringColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ringColor[0], ringColor[1], ringColor[2]);
    doc.text(`${Math.round(strongPct * 100)}%`, cx, cy + 1.5, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text('Semanas fuertes', cx, cy + 17, { align: 'center' });
  }

  doc.setDrawColor(210, 210, 210);
  doc.line(marginX, 64, maxX, 64);

  // Cards de datos clave
  const cardY = 74;
  const cardW = (maxX - marginX - 10) / 3;
  const cards = [
    ['Peso', checkin.weight ? `${checkin.weight} kg` : '—'],
    ['Media pasos', checkin.steps_avg ? Number(checkin.steps_avg).toLocaleString('es-ES') : '—'],
    ['Objetivo', checkin.goal_status || 'Pendiente'],
  ];
  cards.forEach(([label, value], i) => {
    const x = marginX + i * (cardW + 5);
    doc.setFillColor(245, 247, 248);
    doc.roundedRect(x, cardY, cardW, 24, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(label.toUpperCase(), x + 5, cardY + 9);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(String(value), x + 5, cardY + 19);
    doc.setFont('helvetica', 'normal');
  });

  let y = cardY + 36;

  // Gráfica de progreso
  const weightSeries = [...allCheckins]
    .filter((c) => c.weight != null)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8)
    .map((c) => ({ label: monthLabelFull(c.month).slice(0, 3), value: Number(c.weight) }));
  if (weightSeries.length >= 2) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 130, 130);
    doc.text('PROGRESO DE PESO', marginX, y);
    y += 4;
    drawLineChartPDF(doc, marginX + 8, y, maxX - marginX - 12, 32, weightSeries, [8, 145, 178]);
    y += 44;
  }

  const field = (label, value) => {
    if (!value) return;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(94, 156, 196);
    doc.text(label.toUpperCase(), marginX, y);
    y += 6;
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(value), maxX - marginX);
    lines.forEach((line) => { doc.text(line, marginX, y); y += 5.5; });
    y += 4;
  };

  const measurementsText = checkin.measurements && Object.keys(checkin.measurements).length
    ? Object.entries(checkin.measurements).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}cm`).join(' · ')
    : null;

  field('Objetivos del mes',  checkin.goals);
  field('Entrenamiento',      checkin.training_notes);
  field('Nutrición',          checkin.nutrition_notes);
  field('Mediciones',         measurementsText);
  field('Notas',              checkin.notes);

  // Semanas
  if (weeklyNotes.length) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 130, 130);
    doc.text('SEMANAS DEL MES', marginX, y);
    y += 7;
    const dotColors = { Fuerte: [22, 163, 74], Normal: [180, 83, 9], Floja: [220, 38, 38] };
    weeklyNotes.forEach((w) => {
      const c = dotColors[w.strength] || [150, 150, 150];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.circle(marginX + 1.5, y - 1.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(w.label || '', marginX + 6, y);
      if (w.note) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        const noteLines = doc.splitTextToSize(w.note, maxX - marginX - 55);
        doc.text(noteLines[0] || '', marginX + 44, y);
      }
      y += 6.5;
    });
    y += 4;
  }

  // Estado del objetivo
  const okColors = {
    Cumplido:     [22, 163, 74,  234, 243, 222],
    Parcial:      [180, 83, 9,   250, 238, 218],
    'No cumplido':[220, 38, 38,  252, 235, 235],
  };
  const status = checkin.goal_status || 'Pendiente';
  if (okColors[status]) {
    const [tr, tg, tb, br, bg, bb] = okColors[status];
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(marginX, y, maxX - marginX, 14, 2, 2, 'F');
    doc.setTextColor(tr, tg, tb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `${status === 'Cumplido' ? '✓' : status === 'No cumplido' ? '✗' : '~'} ${status}`,
      marginX + 6, y + 9.5
    );
  }

  doc.save(`${client.name.replace(/\s+/g, '_')}_${checkin.month}.pdf`);
}
