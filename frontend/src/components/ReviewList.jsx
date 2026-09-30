import StarRating from './StarRating';

// Etiqueta amigable según cómo le fue al cliente (sale del análisis de la
// reseña o, si no hay texto, de sus estrellas).
const EXPERIENCE_LABELS = {
  positivo: 'Buena experiencia',
  negativo: 'Mala experiencia',
  neutral: 'Experiencia regular',
  mixto: 'Experiencia regular'
};

const SORTERS = {
  recientes: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  mejores: (a, b) => b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at),
  peores: (a, b) => a.rating - b.rating || new Date(b.created_at) - new Date(a.created_at)
};

const TIME_UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60]
];
const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

// "Hace 2 semanas", "Ayer", "Hace un momento"...
function formatRelative(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'Hace un momento';
  for (const [unit, size] of TIME_UNITS) {
    if (seconds >= size) {
      const text = relativeFormat.format(-Math.floor(seconds / size), unit);
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return 'Hace un momento';
}

function formatFullDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ReviewList({ reviews, newReviewId, sort, onSortChange, ratingFilter, onRatingFilterChange }) {
  const visible = reviews
    .filter((r) => !ratingFilter || Number(r.rating) === ratingFilter)
    .sort(SORTERS[sort] || SORTERS.recientes);

  return (
    <div className="review-list">
      {reviews.length > 0 && (
        <div className="review-filters">
          <label className="review-filter">
            <span>Ordenar</span>
            <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
              <option value="recientes">Más recientes</option>
              <option value="mejores">Mejor calificadas</option>
              <option value="peores">Peor calificadas</option>
            </select>
          </label>
          <label className="review-filter">
            <span>Calificación</span>
            <select value={ratingFilter} onChange={(e) => onRatingFilterChange(Number(e.target.value))}>
              <option value={0}>Todas</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)} ({n})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {reviews.length === 0 && (
        <div className="review-card review-card-empty">
          <p className="muted">Aún no hay opiniones. ¡Sé el primero en contar cómo te fue!</p>
        </div>
      )}

      {reviews.length > 0 && visible.length === 0 && (
        <div className="review-card review-card-empty">
          <p className="muted">
            No hay opiniones con {ratingFilter} {ratingFilter === 1 ? 'estrella' : 'estrellas'}.{' '}
            <button type="button" className="link-button" onClick={() => onRatingFilterChange(0)}>
              Ver todas
            </button>
          </p>
        </div>
      )}

      {visible.map((r) => (
        <article key={r.id} className={r.id === newReviewId ? 'review-card review-item-enter' : 'review-card'}>
          <div className="review-item-head">
            <StarRating value={Number(r.rating)} size={15} showValue={false} />
            {r.sentiment && EXPERIENCE_LABELS[r.sentiment] && (
              <span className="review-experience-tag" data-sentiment={r.sentiment}>
                {EXPERIENCE_LABELS[r.sentiment]}
              </span>
            )}
          </div>
          <p className="review-item-meta">
            <strong>{r.user_name}</strong>
            <span className="muted">
              {' · '}
              <time dateTime={r.created_at} title={formatFullDate(r.created_at)}>
                {formatRelative(r.created_at)}
              </time>
            </span>
          </p>
          {r.comment && <p className="review-item-text">{r.comment}</p>}
        </article>
      ))}
    </div>
  );
}
