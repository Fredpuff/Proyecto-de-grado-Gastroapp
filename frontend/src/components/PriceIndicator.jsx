const PRICE_LABELS = { 1: 'económico', 2: 'moderado', 3: 'alto', 4: 'muy alto' };

export default function PriceIndicator({ priceRange }) {
  const level = priceRange?.length || 0;

  return (
    <span className="price-indicator" aria-label={`Precio: ${PRICE_LABELS[level] || priceRange || 'no especificado'}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className={i < level ? 'price-dot price-dot-filled' : 'price-dot'} aria-hidden="true" />
      ))}
    </span>
  );
}
