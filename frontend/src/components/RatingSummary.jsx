import StarRating from './StarRating';

// Nombres amigables de los aspectos que detecta el análisis de reseñas.
const ASPECT_NAMES = {
  comida: 'la comida',
  servicio: 'el servicio',
  ambiente: 'el ambiente',
  precio: 'el precio',
  limpieza: 'la limpieza',
  parqueadero: 'el parqueadero',
  tiempo_espera: 'el tiempo de espera'
};

function joinNames(list) {
  const names = list.map((a) => ASPECT_NAMES[a.aspect] || a.aspect);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

// Lo que más gusta / lo que menos, a partir de los aspectos ya analizados.
function buildHighlights(aspects = []) {
  const liked = aspects
    .filter((a) => a.mentions > 0 && a.positive > a.negative && a.score > 0.15)
    .sort((a, b) => b.positive - a.positive || b.score - a.score)
    .slice(0, 3);
  const disliked = aspects
    .filter((a) => a.mentions > 0 && a.negative >= a.positive && a.score < -0.15)
    .sort((a, b) => b.negative - a.negative || a.score - b.score)
    .slice(0, 2);
  return { liked, disliked };
}

// Calcula promedio, conteo y distribución desde la lista de reseñas que ya
// tiene la página: así todo se actualiza al instante al publicar una nueva.
export function summarizeReviews(reviews = []) {
  const breakdown = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => Number(r.rating) === rating).length
  }));
  const totalCount = reviews.length;
  const sum = reviews.reduce((s, r) => s + Number(r.rating), 0);
  const ratingAvg = totalCount ? sum / totalCount : 0;
  return { ratingAvg, totalCount, breakdown };
}

export default function RatingSummary({
  reviews = [],
  aspects,
  selectedRating,
  onSelectRating,
  onlyStars = false,
  starsSize = 20
}) {
  const { ratingAvg, totalCount, breakdown } = summarizeReviews(reviews);

  // Modo compacto: solo las estrellas del promedio.
    // Modo compacto: estrellas del promedio con la calificación.
  if (onlyStars) {
    return (
      <div
        className="rating-summary-stars-only"
        aria-label={`${ratingAvg.toFixed(1)} de 5 estrellas`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <StarRating value={ratingAvg} size={starsSize} showValue={false} />
        <span className="rating-summary-stars-value">
          {totalCount ? ratingAvg.toFixed(1) : '0.0'}
        </span>
      </div>
    );
  }

  const { liked, disliked } = buildHighlights(aspects);

  if (totalCount === 0) {
    return (
      <div className="rating-summary rating-summary-empty">
        <StarRating value={0} size={22} showValue={false} />
        <p className="muted">Aún no hay calificaciones. ¡Sé el primero en opinar!</p>
      </div>
    );
  }

  return (
    <div className="rating-summary">
      <div className="rating-summary-top">
        <span className="rating-summary-number">{ratingAvg.toFixed(1)}</span>
        <div className="rating-summary-top-right">
          <StarRating value={ratingAvg} size={20} showValue={false} />
          <span className="rating-summary-count muted">
            {totalCount} {totalCount === 1 ? 'calificación' : 'calificaciones'}
          </span>
        </div>
      </div>

      <div className="rating-summary-bars">
        {breakdown.map(({ rating, count }) => {
          const active = selectedRating === rating;
          return (
            <button
              key={rating}
              type="button"
              className={active ? 'rating-bar-row rating-bar-row-active' : 'rating-bar-row'}
              onClick={() => onSelectRating?.(active ? 0 : rating)}
              disabled={count === 0}
              aria-pressed={active}
              aria-label={`Ver opiniones de ${rating} ${rating === 1 ? 'estrella' : 'estrellas'} (${count})`}
            >
              <span className="rating-bar-label">{rating} ★</span>
              <span className="rating-bar-track">
                <span className="rating-bar-fill" style={{ width: `${(count / totalCount) * 100}%` }} />
              </span>
              <span className="rating-bar-count">{count}</span>
            </button>
          );
        })}
      </div>

      {(liked.length > 0 || disliked.length > 0) && (
        <div className="rating-highlights">
          {liked.length > 0 && (
            <p>
              <span aria-hidden="true">👍</span> <strong>Lo que más gusta:</strong> {joinNames(liked)}
            </p>
          )}
          {disliked.length > 0 && (
            <p>
              <span aria-hidden="true">👎</span> <strong>A mejorar:</strong> {joinNames(disliked)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}