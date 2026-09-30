import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { photoUrls } from '../api/resources';
import StarRating from './StarRating';
import ParkingBadge from './ParkingBadge';
import PriceIndicator from './PriceIndicator';
import RestaurantImagePlaceholder from './RestaurantImagePlaceholder';

export default function RestaurantCard({ restaurant }) {
  const { id, name, cuisine_type, price_range, neighborhood, rating_avg, parking_type, has_wifi } = restaurant;
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <Link to={`/restaurantes/${id}`} className="card restaurant-card-link">
      <div className="restaurant-card-media">
        {imgFailed ? (
          <RestaurantImagePlaceholder cuisine={cuisine_type} />
        ) : (
          // Invisible hasta que carga: si falla nunca se ve el ícono de imagen rota.
          <img
            src={photoUrls.main(id)}
            alt=""
            loading="lazy"
            className={imgLoaded ? 'is-loaded' : undefined}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        )}
        <span className="restaurant-card-price-chip">
          <PriceIndicator priceRange={price_range} />
        </span>
      </div>

      <div className="restaurant-card-body">
        <h3 className="restaurant-card-title">{name}</h3>

        <p className="muted restaurant-card-meta">
          {cuisine_type} · {neighborhood}
        </p>

        <div className="restaurant-card-footer">
          <StarRating value={Number(rating_avg)} />
          <div className="restaurant-card-badges">
            {!!has_wifi && (
              <span className="badge">
                <Wifi size={13} strokeWidth={2.2} aria-hidden="true" />
                Wifi
              </span>
            )}
            <ParkingBadge type={parking_type} />
          </div>
        </div>
      </div>
    </Link>
  );
}
