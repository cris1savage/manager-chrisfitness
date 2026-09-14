'use client';

import { useState } from 'react';

// Puntos de medición sobre el cuerpo: [x%, y%, nombre, clave]
const PUNTOS = [
  { x: 50,  y: 7,  label: 'Cuello',       key: 'Cuello'       },
  { x: 50,  y: 16, label: 'Hombros',      key: 'Hombros'      },
  { x: 50,  y: 23, label: 'Pecho',        key: 'Pecho'        },
  { x: 27,  y: 24, label: 'Bíceps izq',   key: 'Bíceps izq'   },
  { x: 73,  y: 24, label: 'Bíceps der',   key: 'Bíceps der'   },
  { x: 23,  y: 32, label: 'Antebrazo izq',key: 'Antebrazo izq'},
  { x: 77,  y: 32, label: 'Antebrazo der',key: 'Antebrazo der'},
  { x: 50,  y: 33, label: 'Cintura',      key: 'Cintura'      },
  { x: 50,  y: 41, label: 'Cadera',       key: 'Cadera'       },
  { x: 37,  y: 57, label: 'Muslo izq',    key: 'Muslo izq'    },
  { x: 63,  y: 57, label: 'Muslo der',    key: 'Muslo der'    },
  { x: 37,  y: 74, label: 'Gemelo izq',   key: 'Gemelo izq'   },
  { x: 63,  y: 74, label: 'Gemelo der',   key: 'Gemelo der'   },
];

const COLORS = {
  default: '#5ECCFA',
  active:  '#FBBF24',
  hasData: '#4ADE80',
};

export default function MuñecoMedidas({ measurements = {}, prevMeasurements = {}, onSelect }) {
  const [active, setActive] = useState(null);

  const handleClick = (p) => {
    setActive(p.key === active ? null : p.key);
    onSelect?.(p.key);
  };

  const getColor = (key) => {
    if (key === active) return COLORS.active;
    if (measurements[key] != null) return COLORS.hasData;
    return COLORS.default;
  };

  const getDiff = (key) => {
    const cur = measurements[key];
    const prev = prevMeasurements[key];
    if (cur == null || prev == null) return null;
    return Math.round((cur - prev) * 10) / 10;
  };

  return (
    <div className="relative w-full" style={{ maxWidth: 260, margin: '0 auto' }}>
      {/* SVG del cuerpo humano esquemático */}
      <svg viewBox="0 0 200 420" style={{ width: '100%', display: 'block' }}>
        {/* Cabeza */}
        <ellipse cx="100" cy="22" rx="18" ry="20" fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Cuello */}
        <rect x="93" y="40" width="14" height="12" rx="3" fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Torso */}
        <path d="M65 52 L55 110 L75 115 L75 155 L125 155 L125 115 L145 110 L135 52 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Brazo izquierdo */}
        <path d="M65 54 L45 80 L38 115 L44 117 L52 85 L70 62 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Antebrazo izquierdo */}
        <path d="M38 115 L30 148 L36 150 L44 117 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Brazo derecho */}
        <path d="M135 54 L155 80 L162 115 L156 117 L148 85 L130 62 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Antebrazo derecho */}
        <path d="M162 115 L170 148 L164 150 L156 117 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Cadera/pelvis */}
        <path d="M75 155 L68 185 L132 185 L125 155 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Muslo izquierdo */}
        <path d="M68 185 L60 255 L78 255 L82 185 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Muslo derecho */}
        <path d="M132 185 L140 255 L122 255 L118 185 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Gemelo izquierdo */}
        <path d="M60 255 L56 320 L76 320 L78 255 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Gemelo derecho */}
        <path d="M140 255 L144 320 L124 320 L122 255 Z"
          fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Pie izquierdo */}
        <ellipse cx="66" cy="326" rx="12" ry="6" fill="none" stroke="#2A3336" strokeWidth="2"/>
        {/* Pie derecho */}
        <ellipse cx="134" cy="326" rx="12" ry="6" fill="none" stroke="#2A3336" strokeWidth="2"/>

        {/* Líneas de cintura */}
        <line x1="72" y1="135" x2="128" y2="135" stroke="#2A3336" strokeWidth="1" strokeDasharray="3 2"/>

        {/* Puntos interactivos */}
        {PUNTOS.map((p) => {
          const color  = getColor(p.key);
          const val    = measurements[p.key];
          const diff   = getDiff(p.key);
          const isActive = p.key === active;
          const cx = (p.x / 100) * 200;
          const cy = (p.y / 100) * 420;

          return (
            <g key={p.key} onClick={() => handleClick(p)} style={{ cursor: 'pointer' }}>
              {/* Pulso animado si tiene datos */}
              {val != null && !isActive && (
                <circle cx={cx} cy={cy} r="10" fill={color} opacity="0.15">
                  <animate attributeName="r" values="8;13;8" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite"/>
                </circle>
              )}
              {/* Punto principal */}
              <circle cx={cx} cy={cy} r={isActive ? 8 : 6}
                fill={color} opacity={0.9}
                stroke={isActive ? '#fff' : color}
                strokeWidth={isActive ? 2 : 1}
              />
              {/* Valor si tiene datos */}
              {val != null && !isActive && (
                <text x={cx} y={cy - 10} textAnchor="middle"
                  fill={color} fontSize="9" fontWeight="700">
                  {val}
                </text>
              )}
              {/* Tooltip activo */}
              {isActive && (
                <g>
                  <rect x={cx > 100 ? cx - 80 : cx + 4} y={cy - 28} width="72" height="38"
                    rx="6" fill="#0E1214" stroke={color} strokeWidth="1.5"/>
                  <text x={cx > 100 ? cx - 44 : cx + 40} y={cy - 14}
                    textAnchor="middle" fill="#F2F6F7" fontSize="9" fontWeight="700">
                    {p.label}
                  </text>
                  <text x={cx > 100 ? cx - 44 : cx + 40} y={cy - 4}
                    textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
                    {val != null ? `${val} cm` : '—'}
                  </text>
                  {diff != null && (
                    <text x={cx > 100 ? cx - 44 : cx + 40} y={cy + 6}
                      textAnchor="middle"
                      fill={diff < 0 ? '#4ADE80' : diff > 0 ? '#F87171' : '#7C878B'}
                      fontSize="9" fontWeight="600">
                      {diff > 0 ? '+' : ''}{diff} cm
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
        {[
          { color: COLORS.hasData, label: 'Con datos' },
          { color: COLORS.default, label: 'Sin datos' },
          { color: COLORS.active,  label: 'Seleccionado' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: 9, color: '#7C878B' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
