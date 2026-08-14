'use client';

export function Card({ children, className = '', style = {}, ...rest }) {
  return (
    <div
      className={`rounded-xl p-4 bg-surface border border-border ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, color = '#5ECCFA' }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="rounded-lg p-2.5 shrink-0" style={{ background: `${color}1A` }}>
        <Icon size={20} color={color} />
      </div>
      <div className="min-w-0">
        <div className="text-muted text-[11.5px] uppercase tracking-wide truncate">{label}</div>
        <div className="text-ink text-xl font-extrabold font-display tracking-wide">{value}</div>
      </div>
    </Card>
  );
}

export function Field({ f, value, onChange }) {
  const base =
    'bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan';
  if (f.type === 'select') {
    return (
      <select className={base} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {f.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={base}
      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
      placeholder={f.placeholder || f.label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Ring({ pct, size = 84, stroke = 8, color = '#5ECCFA', label, value }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct || 0));
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#212729" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - clamped * c}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x={size / 2}
          y={size / 2}
          fill="#F2F6F7"
          fontSize={16}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {Math.round(clamped * 100)}%
        </text>
      </svg>
      <div className="text-center">
        <div className="text-ink text-[13px] font-semibold">{label}</div>
        <div className="text-muted text-[11px]">{value}</div>
      </div>
    </div>
  );
}

// Iniciales de quién creó el registro, para saber a simple vista si lo metió
// Chris o su socia sin tener que abrir cada fila.
export function AuthorBadge({ profile }) {
  if (!profile) return null;
  const initials = (profile.display_name || '?').slice(0, 2).toUpperCase();
  return (
    <div
      title={profile.display_name}
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-cyan/15 text-cyan border border-cyan/30"
    >
      {initials}
    </div>
  );
}
