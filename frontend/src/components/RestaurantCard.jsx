import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import ParkingBadge from './ParkingBadge';

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function RestaurantCard({ restaurant }) {
  const { id, name, cuisine_type, price_range, neighborhood, rating_avg, parking_type, has_wifi, image_url } =
    restaurant;

  return (
    <Link
      to={`/restaurantes/${id}`}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: 'inherit' }}
    >
      <div className="restaurant-card-media">
        {image_url ? (
          <img src={image_url} alt={name} loading="lazy" />
        ) : (
          <span className="restaurant-card-initials">{initials(name)}</span>
        )}
      </div>

      <div className="restaurant-card-body">
        <div className="restaurant-card-title-row">
          <h3>{name}</h3>
          <span className="price">{price_range}</span>
        </div>

        <p className="muted restaurant-card-meta">
          {cuisine_type} · {neighborhood}
        </p>

        <div className="restaurant-card-footer">
          <StarRating value={Number(rating_avg)} />
          <div className="restaurant-card-badges">
            {!!has_wifi && <span className="badge badge-outline">📶 Wifi</span>}
            <ParkingBadge type={parking_type} />
          </div>
        </div>
      </div>
    </Link>
  );
}
