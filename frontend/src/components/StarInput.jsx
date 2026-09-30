import { useState } from 'react';

const LABELS = { 1: 'Muy mala', 2: 'Mala', 3: 'Regular', 4: 'Buena', 5: 'Excelente' };

// Selector de calificación con estrellas clicables (grupo de radios accesible:
// flechas del teclado cambian el valor). Los botones son type="button" para
// que hacer clic en una estrella nunca envíe el formulario que lo contiene.
// value = 0 significa "sin elegir": ninguna estrella viene marcada de antemano.
export default function StarInput({ value, onChange, id, disabled = false }) {
  const [hovered, setHovered] = useState(0);
  // Mientras está deshabilitado el navegador no dispara mouseleave sobre los
  // botones, así que el hover se ignora para que no quede "pegado".
  const shown = (!disabled && hovered) || value;

  function select(n) {
    setHovered(0);
    onChange(n);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(Math.min(5, (value || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(Math.max(1, (value || 1) - 1));
    }
  }

  return (
    <div className="star-input">
      <div
        id={id}
        role="radiogroup"
        aria-label="Calificación"
        className="star-input-stars"
        onMouseLeave={() => setHovered(0)}
        onKeyDown={handleKeyDown}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'} (${LABELS[n]})`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            disabled={disabled}
            className={n <= shown ? 'star-input-star star-input-star-on' : 'star-input-star'}
            onClick={() => select(n)}
            onMouseEnter={() => setHovered(n)}
          >
            ★
          </button>
        ))}
      </div>
      <span className="star-input-label muted">{shown ? LABELS[shown] : 'Toca una estrella'}</span>
    </div>
  );
}
