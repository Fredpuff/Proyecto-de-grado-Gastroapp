import StarRating from './StarRating';

const SENTIMENT_LABELS = { positivo: 'Positiva', neutral: 'Neutral', negativo: 'Negativa', mixto: 'Mixta' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ReviewList({ reviews, newReviewId }) {
  if (reviews.length === 0) {
    return <p className="muted">Todavía no hay reseñas. ¡Sé el primero en opinar!</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {reviews.map((r) => (
        <div
          key={r.id}
          className={r.id === newReviewId ? 'card review-item-enter' : 'card'}
          style={{ padding: 14 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>
              <strong>{r.user_name}</strong>
              {r.sentiment && (
                <span className="review-sentiment-tag" data-sentiment={r.sentiment}>
                  {SENTIMENT_LABELS[r.sentiment] || r.sentiment}
                </span>
              )}
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {formatDate(r.created_at)}
            </span>
          </div>
          <StarRating value={r.rating} showValue={false} />
          {r.comment && <p style={{ marginTop: 8, marginBottom: 0 }}>{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}
