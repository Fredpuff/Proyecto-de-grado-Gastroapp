import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { restaurantsApi, menuApi, reviewsApi } from '../api/resources';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ParkingBadge from '../components/ParkingBadge';
import RestaurantMap from '../components/RestaurantMap';
import ReviewList from '../components/ReviewList';
import ReviewForm from '../components/ReviewForm';

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [nearbyParkings, setNearbyParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      restaurantsApi.get(id),
      menuApi.listByRestaurant(id),
      reviewsApi.listByRestaurant(id),
      restaurantsApi.nearbyParkings(id, 2)
    ])
      .then(([r, m, rv, p]) => {
        setRestaurant(r);
        setMenu(m);
        setReviews(rv);
        setNearbyParkings(p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container" style={{ padding: 40 }}>Cargando...</div>;
  if (error)
    return (
      <div className="container" style={{ padding: 40 }}>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  if (!restaurant) return null;

  const groupedMenu = menu.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="container" style={{ padding: '32px 20px 60px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Link to="/" className="muted" style={{ fontSize: 14 }}>
        ← Volver a la búsqueda
      </Link>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>{restaurant.name}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {restaurant.cuisine_type} · {restaurant.neighborhood} · {restaurant.price_range}
            </p>
          </div>
          <StarRating value={Number(restaurant.rating_avg)} size={20} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {!!restaurant.has_wifi && <span className="badge badge-outline">📶 Wifi</span>}
          <ParkingBadge type={restaurant.parking_type} />
          {!!restaurant.kids_zone && <span className="badge badge-outline">🧒 Zona de niños</span>}
        </div>
      </div>

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
          <section>
            <h2>Menú digital</h2>
            {menu.length === 0 && <p className="muted">Este restaurante aún no ha publicado su menú.</p>}
            {Object.entries(groupedMenu).map(([category, items]) => (
              <div key={category} style={{ marginBottom: 20 }}>
                <h4 style={{ color: 'var(--color-olive-dark)' }}>{category}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        borderBottom: '1px dashed var(--color-border)',
                        paddingBottom: 8
                      }}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        {item.description && (
                          <p className="muted" style={{ margin: '2px 0 0', fontSize: 13.5 }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                      <strong style={{ whiteSpace: 'nowrap' }}>
                        ${Number(item.price).toLocaleString('es-CO')}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2>Reseñas ({reviews.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {user ? (
                <ReviewForm restaurantId={id} onCreated={(r) => setReviews([r, ...reviews])} />
              ) : (
                <p className="muted">
                  <Link to="/login">Inicia sesión</Link> para dejar tu reseña.
                </p>
              )}
              <ReviewList reviews={reviews} />
            </div>
          </section>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div className="card" style={{ padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Información</h4>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Dirección:</strong>
              <br />
              {restaurant.address}
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Horario:</strong>
              <br />
              {restaurant.opening_hours}
            </p>
            {restaurant.phone && (
              <p style={{ margin: '0 0 8px' }}>
                <strong>Teléfono:</strong>
                <br />
                {restaurant.phone}
              </p>
            )}
            {restaurant.website && (
              <p style={{ margin: 0 }}>
                <a href={restaurant.website} target="_blank" rel="noreferrer">
                  Sitio web / redes ↗
                </a>
              </p>
            )}
          </div>

          <div>
            <h4>Ubicación y parqueaderos cercanos</h4>
            <RestaurantMap restaurant={restaurant} parkings={nearbyParkings} />
            {nearbyParkings.length === 0 && (
              <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
                No hay parqueaderos registrados a menos de 2 km.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
