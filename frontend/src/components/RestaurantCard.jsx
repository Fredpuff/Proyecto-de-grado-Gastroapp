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
      style={{ display: 'block', overflow: 'hidden', color: 'inherit' }}
    >
      <div
        style={{
          height: 140,
          background: image_url
            ? `url(${image_url}) center/cover`
            : 'linear-gradient(135deg, var(--color-primary-light), var(--color-olive-light))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {!image_url && (
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--color-primary-dark)',
              opacity: 0.7
            }}
          >
            {initials(name)}
          </span>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <h3 style={{ fontSize: 17, margin: '0 0 4px' }}>{name}</h3>
          <span style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>{price_range}</span>
        </div>

        <p className="muted" style={{ fontSize: 13.5, margin: '0 0 10px' }}>
          {cuisine_type} · {neighborhood}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <StarRating value={Number(rating_avg)} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!!has_wifi && <span className="badge badge-outline">📶 Wifi</span>}
            <ParkingBadge type={parking_type} />
          </div>
        </div>
      </div>
    </Link>
  );
}
