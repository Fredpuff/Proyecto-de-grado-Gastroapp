const PRICE_LABELS = { 1: 'Económico', 2: 'Moderado', 3: 'Alto', 4: 'Muy alto' };

export default function PriceIndicator({ priceRange, showLabel = false }) {
  const level = priceRange?.length || 0;
  const label = PRICE_LABELS[level] || 'No especificado';

  return (
    <span className="price-indicator" aria-label={`Precio: ${label.toLowerCase()}`} title={`Precio ${label.toLowerCase()}`}>
      <span className="price-signs" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className={i < level ? 'price-sign price-sign-active' : 'price-sign'}>
            $
          </span>
        ))}
      </span>
      {showLabel && level > 0 && <span className="price-label">{label}</span>}
    </span>
  );
}