import { useState } from 'react';

export default function PhotoGallery({ photos, altPrefix = 'Foto' }) {
  const [current, setCurrent] = useState(0);
  const [failedIndexes, setFailedIndexes] = useState(new Set());

  const visible = photos.filter((_, i) => !failedIndexes.has(i));

  if (visible.length === 0) return null;

  const safeCurrent = Math.min(current, visible.length - 1);

  function prev() {
    setCurrent((c) => (c === 0 ? visible.length - 1 : c - 1));
  }
  function next() {
    setCurrent((c) => (c === visible.length - 1 ? 0 : c + 1));
  }
  function handleError(originalIndex) {
    setFailedIndexes((s) => {
      const next = new Set(s);
      next.add(originalIndex);
      return next;
    });
    setCurrent((c) => Math.min(c, visible.length - 2 < 0 ? 0 : visible.length - 2));
  }

  return (
    <div className="photo-gallery">
      <div className="photo-gallery-track">
        {visible.map((url, idx) => {
          const originalIndex = photos.indexOf(url);
          return (
            <img
              key={url}
              src={url}
              alt={`${altPrefix} ${idx + 1}`}
              loading="lazy"
              className={`photo-gallery-img${idx === safeCurrent ? ' active' : ''}`}
              onError={() => handleError(originalIndex)}
            />
          );
        })}

        {visible.length > 1 && (
          <>
            <button
              className="photo-gallery-btn photo-gallery-btn-prev"
              onClick={prev}
              aria-label="Foto anterior"
            >
              ‹
            </button>
            <button
              className="photo-gallery-btn photo-gallery-btn-next"
              onClick={next}
              aria-label="Siguiente foto"
            >
              ›
            </button>
          </>
        )}

        <div className="photo-gallery-counter" aria-live="polite">
          {safeCurrent + 1} / {visible.length}
        </div>
      </div>

      {visible.length > 1 && (
        <div className="photo-gallery-dots" role="tablist" aria-label="Miniaturas">
          {visible.map((_, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={idx === safeCurrent}
              className={`photo-gallery-dot${idx === safeCurrent ? ' active' : ''}`}
              onClick={() => setCurrent(idx)}
              aria-label={`Ir a foto ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
