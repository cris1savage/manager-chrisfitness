export default function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)', ...style }}
    >
      {children}
    </div>
  );
}
