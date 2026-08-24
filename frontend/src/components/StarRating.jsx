export default function StarRating({ value = 0, size = 16, showValue = true }) {
  const rounded = Math.round(value * 2) / 2;
  const stars = [1, 2, 3, 4, 5];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-flex', fontSize: size }} aria-hidden="true">
        {stars.map((s) => {
          const filled = s <= rounded;
          const half = !filled && s - 0.5 === rounded;
          return (
            <span key={s} style={{ color: filled || half ? 'var(--color-accent)' : '#dcd2c0' }}>
              {half ? '★' : filled ? '★' : '☆'}
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          {value?.toFixed ? value.toFixed(1) : value}
        </span>
      )}
    </span>
  );
}
