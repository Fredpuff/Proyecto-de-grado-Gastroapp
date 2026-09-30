import { useRef, useState } from 'react';
import RestaurantImagePlaceholder from './RestaurantImagePlaceholder';

const SWIPE_MIN_PX = 40;

// Carrusel de fotos del restaurante (sin autoplay).
// - photos === null: todavía se están pidiendo las rutas → skeleton.
// - photos vacío o todas fallaron: placeholder del mismo tamaño.
// Solo se montan la foto actual y sus vecinas: así se precargan la siguiente
// y la anterior sin descargar toda la galería de una vez. Si una foto falla,
// se salta. Para empezar de nuevo en la foto 1 al cambiar de restaurante, el
// padre le pone key={restaurantId}.
export default function PhotoGallery({ photos, altPrefix = 'Foto', cuisine }) {
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState(() => new Set());
  const [loaded, setLoaded] = useState(() => new Set());
  // En un ref (no en estado) para que un gesto rápido no lea un valor viejo.
  const touchStartX = useRef(null);

  if (photos === null) {
    return <div className="photo-carousel-frame skeleton-block" aria-label="Cargando fotos" />;
  }

  const visible = photos.filter((url) => !failed.has(url));

  if (visible.length === 0) {
    return (
      <div className="photo-carousel-frame">
        <RestaurantImagePlaceholder cuisine={cuisine} iconSize={48} />
      </div>
    );
  }

  const total = visible.length;
  const index = Math.min(current, total - 1);
  const currentUrl = visible[index];
  const prevIndex = (index - 1 + total) % total;
  const nextIndex = (index + 1) % total;
  const mounted = new Set([index, prevIndex, nextIndex]);

  const goTo = (i) => setCurrent(((i % total) + total) % total);
  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  function markFailed(url) {
    setFailed((s) => new Set(s).add(url));
  }
  function markLoaded(url) {
    setLoaded((s) => (s.has(url) ? s : new Set(s).add(url)));
  }

  function handleKeyDown(e) {
    if (total < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    }
  }

  function handleTouchEnd(e) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || total < 2) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (dx < 0) next();
    else prev();
  }

  return (
    <div className="photo-carousel">
      <div
        className="photo-carousel-frame"
        role="region"
        aria-roledescription="carrusel"
        aria-label={`Fotos de ${altPrefix}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        {!loaded.has(currentUrl) && <div className="photo-carousel-loading skeleton-block" aria-hidden="true" />}

        {visible.map((url, i) =>
          mounted.has(i) ? (
            <img
              key={url}
              src={url}
              alt={i === index ? `${altPrefix}, foto ${i + 1} de ${total}` : ''}
              className={`photo-carousel-img${i === index && loaded.has(url) ? ' is-active' : ''}`}
              draggable={false}
              onLoad={() => markLoaded(url)}
              onError={() => markFailed(url)}
            />
          ) : null
        )}

        {total > 1 && (
          <>
            <button type="button" className="photo-carousel-btn photo-carousel-btn-prev" onClick={prev} aria-label="Foto anterior">
              ‹
            </button>
            <button type="button" className="photo-carousel-btn photo-carousel-btn-next" onClick={next} aria-label="Foto siguiente">
              ›
            </button>
          </>
        )}

        <div className="photo-carousel-counter" aria-live="polite">
          {index + 1} / {total}
        </div>
      </div>

      {total > 1 && (
        <div className="photo-carousel-dots" aria-label="Elegir foto">
          {visible.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`photo-carousel-dot${i === index ? ' is-active' : ''}`}
              aria-label={`Ir a la foto ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
