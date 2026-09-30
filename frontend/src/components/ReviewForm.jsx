import { useState } from 'react';
import { reviewsApi } from '../api/resources';
import StarInput from './StarInput';

export default function ReviewForm({ restaurantId, onCreated }) {
  // 0 = sin elegir: antes arrancaba en 5 y parecía que las estrellas ya
  // estaban marcadas, así que muchas reseñas se enviaban con 5 sin querer.
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) {
      setError('Elige de 1 a 5 estrellas para calificar.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const review = await reviewsApi.create(restaurantId, { rating, comment: comment.trim() });
      setComment('');
      setRating(0);
      onCreated(review);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card review-form">
      <h3 className="review-form-title">Escribe tu opinión</h3>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label>¿Cómo calificarías este lugar?</label>
        <StarInput
          id="rating"
          value={rating}
          onChange={(n) => {
            setRating(n);
            setError('');
          }}
          disabled={submitting}
        />
      </div>

      <div className="field">
        <label htmlFor="comment">Cuéntanos tu experiencia (opcional)</label>
        <textarea
          id="comment"
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="¿Qué te gustó? ¿Qué se podría mejorar?"
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Publicando...' : 'Publicar'}
      </button>
    </form>
  );
}
