import { UtensilsCrossed } from 'lucide-react';

// Se muestra cuando un restaurante no tiene foto o la foto no carga: nunca el
// ícono de imagen rota ni el texto alternativo encima.
export default function RestaurantImagePlaceholder({ cuisine, iconSize = 34 }) {
  return (
    <div className="restaurant-img-placeholder" aria-hidden="true">
      <UtensilsCrossed size={iconSize} strokeWidth={1.6} />
      {cuisine && <span className="restaurant-img-placeholder-label">{cuisine}</span>}
    </div>
  );
}
