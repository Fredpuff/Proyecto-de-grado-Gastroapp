import { useEffect, useRef, useState } from 'react';
import { reviewsApi } from '../api/resources';

const ASPECT_LABELS = {
  comida: 'Comida',
  servicio: 'Servicio',
  ambiente: 'Ambiente',
  precio: 'Precio',
  limpieza: 'Limpieza',
  parqueadero: 'Parqueadero',
  tiempo_espera: 'Tiempo de espera'
};

const SENTIMENT_LABELS = { positivo: 'Positivas', neutral: 'Neutrales', negativo: 'Negativas', mixto: 'Mixtas' };

function overallHeadline(sentimentIndex) {
  if (sentimentIndex === null) return null;
  if (sentimentIndex >= 70) return 'Las opiniones son, en su mayoría, positivas.';
  if (sentimentIndex >= 45) return 'Las opiniones sobre este restaurante son mixtas.';
  return 'Las opiniones son, en su mayoría, negativas.';
}

function aspectVerdict(score) {
  if (score >= 0.6) return 'Muy bien valorado';
  if (score >= 0.2) return 'Bien valorado';
  if (score > -0.2) return 'Divide opiniones';
  if (score > -0.6) return 'Con críticas';
  return 'Mal valorado';
}

function AspectBar({ score }) {
  const clamped = Math.max(-1, Math.min(1, score));
  const widthPct = Math.abs(clamped) * 50;
  const positive = clamped >= 0;

  return (
    <div className="aspect-bar-track">
      <div className="aspect-bar-center" />
      <div
        className={`aspect-bar-fill ${positive ? 'aspect-bar-fill-positive' : 'aspect-bar-fill-negative'}`}
        style={{ width: `${widthPct}%`, [positive ? 'left' : 'right']: '50%' }}
      />
    </div>
  );
}

// refreshKey: el padre lo incrementa para pedir un refetch (p. ej. cuando
// termina el análisis de una reseña recién creada). Los refetch no vuelven a
// mostrar el skeleton ni borran los datos si fallan: solo la carga inicial.
export default function ReviewInsights({ restaurantId, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dataRef = useRef(null);
  dataRef.current = data;

  useEffect(() => {
    setData(null);
    setLoading(true);
  }, [restaurantId]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');

    reviewsApi
      .insights(restaurantId, { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!dataRef.current) setError(err.message || 'No pudimos cargar el análisis de opiniones.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [restaurantId, refreshKey]);

  if (loading) {
    return (
      <section className="card review-insights" aria-label="Análisis de opiniones">
        <h2>Análisis de opiniones</h2>
        <div className="skeleton-line" style={{ width: '70%' }} />
        <div className="skeleton-block" style={{ height: 60 }} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="card review-insights" aria-label="Análisis de opiniones">
        <h2>Análisis de opiniones</h2>
        <div className="alert alert-error">{error}</div>
      </section>
    );
  }

  if (!data || data.totalAnalyzed === 0) {
    return (
      <section className="card review-insights" aria-label="Análisis de opiniones">
        <h2>Análisis de opiniones</h2>
        <p className="muted">Todavía no hay reseñas analizadas.</p>
      </section>
    );
  }

  const { sentimentIndex, counts, aspects, keywords, summary } = data;
  const total = counts.positivo + counts.neutral + counts.negativo + counts.mixto || 1;
  const segments = [
    { key: 'positivo', count: counts.positivo },
    { key: 'neutral', count: counts.neutral },
    { key: 'mixto', count: counts.mixto },
    { key: 'negativo', count: counts.negativo }
  ];

  return (
    <section className="card review-insights" aria-label="Análisis de opiniones">
      <h2>Análisis de opiniones</h2>

      <p className="review-insights-headline">{overallHeadline(sentimentIndex)}</p>

      <div>
        <div
          className="sentiment-bar"
          role="img"
          aria-label={`Distribución de sentimiento: ${counts.positivo} positivas, ${counts.neutral} neutrales, ${counts.mixto} mixtas, ${counts.negativo} negativas`}
        >
          {segments.map(
            (s) =>
              s.count > 0 && (
                <div
                  key={s.key}
                  className={`sentiment-bar-segment sentiment-bar-segment-${s.key}`}
                  style={{ width: `${(s.count / total) * 100}%` }}
                />
              )
          )}
        </div>
        <p className="sentiment-bar-counts muted">
          {segments.map((s) => `${SENTIMENT_LABELS[s.key]}: ${s.count}`).join(' · ')}
        </p>
      </div>

      {summary && <p className="review-insights-summary">{summary}</p>}

      {aspects.length > 0 && (
        <ul className="aspect-list">
          {aspects.map((a) => (
            <li key={a.aspect} className="aspect-row">
              <div className="aspect-row-head">
                <span className="aspect-name">{ASPECT_LABELS[a.aspect] || a.aspect}</span>
                <span className="muted">{aspectVerdict(a.score)}</span>
              </div>
              <AspectBar score={a.score} />
              <span className="aspect-mentions muted">
                {a.mentions} {a.mentions === 1 ? 'mención' : 'menciones'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {keywords.length > 0 && (
        <p className="review-insights-keywords">
          <strong>Palabras clave:</strong> {keywords.map((k) => k.term).join(', ')}
        </p>
      )}
    </section>
  );
}
