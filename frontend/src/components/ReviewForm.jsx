import { useState } from 'react';
import { reviewsApi } from '../api/resources';

export default function ReviewForm({ restaurantId, onCreated }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const review = await reviewsApi.create(restaurantId, { rating: Number(rating), comment });
      setComment('');
      setRating(5);
      onCreated(review);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Deja tu reseña</h4>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="rating">Calificación</label>
        <select id="rating" value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}
              {'☆'.repeat(5 - n)} ({n})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="comment">Comentario (opcional)</label>
        <textarea
          id="comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos tu experiencia..."
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Enviando...' : 'Publicar reseña'}
      </button>
    </form>
  );
}
