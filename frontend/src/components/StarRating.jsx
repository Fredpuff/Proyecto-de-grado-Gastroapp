export default function StarRating({ value = 0, size = 16, showValue = true }) {
  const rounded = Math.round(value * 2) / 2;
  const stars = [1, 2, 3, 4, 5];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-flex', fontSize: size }} aria-hidden="true">
        {stars.map((s) => {
          const filled = s <= rounded;
          const half = !filled && s - 0.5 === rounded;
          if (half) {
            // Media estrella: mitad izquierda con color, mitad derecha vacía.
            return (
              <span
                key={s}
                style={{
                  background: 'linear-gradient(90deg, var(--color-accent) 50%, var(--star-empty-color, #dcd2c0) 50%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}
              >
                ★
              </span>
            );
          }
          return (
            <span key={s} style={{ color: filled ? 'var(--color-accent)' : 'var(--star-empty-color, #dcd2c0)' }}>
              {filled ? '★' : '☆'}
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
