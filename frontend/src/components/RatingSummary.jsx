export default function RatingSummary({ ratingAvg, totalCount, breakdown }) {
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <div className="rating-summary">
      <div className="rating-summary-left">
        <span className="rating-summary-number">{Number(ratingAvg).toFixed(1)}</span>
        <span className="rating-summary-stars" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((s) => {
            const rounded = Math.round(ratingAvg * 2) / 2;
            const filled = s <= rounded;
            const half = !filled && s - 0.5 === rounded;
            return (
              <span
                key={s}
                style={{ color: filled || half ? 'var(--color-accent)' : 'var(--star-empty-color, rgba(245,238,240,0.28))' }}
              >
                ★
              </span>
            );
          })}
        </span>
        <span className="rating-summary-count muted">
          {totalCount} {totalCount === 1 ? 'calificación' : 'calificaciones'}
        </span>
      </div>

      <div className="rating-summary-bars">
        {breakdown.map(({ rating, count }) => (
          <div key={rating} className="rating-bar-row">
            <span className="rating-bar-label">{rating}★</span>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill"
                style={{ width: `${totalCount > 0 ? (count / maxCount) * 100 : 0}%` }}
              />
            </div>
            <span className="rating-bar-count muted">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
