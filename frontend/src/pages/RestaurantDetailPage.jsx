import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { restaurantsApi, menuApi, reviewsApi, photoUrls } from '../api/resources';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ParkingBadge from '../components/ParkingBadge';
import PriceIndicator from '../components/PriceIndicator';
import RestaurantMap from '../components/RestaurantMap';
import ReviewList from '../components/ReviewList';
import ReviewForm from '../components/ReviewForm';
import RatingSummary from '../components/RatingSummary';
import PhotoGallery from '../components/PhotoGallery';

const SHOW_DIGITAL_MENU = false; // Menú digital oculto temporalmente, se retomará después

const ANALYSIS_POLL_MS = 4000;
const ANALYSIS_POLL_MAX_ATTEMPTS = 5;

// Aspectos para "Lo que más gusta / A mejorar"; si falla, simplemente no se muestran.
function fetchAspects(id) {
  return reviewsApi
    .insights(id)
    .then((ins) => ins?.aspects ?? [])
    .catch(() => []);
}

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [nearbyParkings, setNearbyParkings] = useState([]);
  const [aspects, setAspects] = useState([]);
  const [reviewSort, setReviewSort] = useState('recientes');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [galleryPhotos, setGalleryPhotos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newReviewId, setNewReviewId] = useState(null);
  const [analyzingReviewId, setAnalyzingReviewId] = useState(null);

  useEffect(() => {
    if (!newReviewId) return undefined;
    const timer = setTimeout(() => setNewReviewId(null), 300);
    return () => clearTimeout(timer);
  }, [newReviewId]);

  // Polling corto tras crear una reseña: la reseña ya se ve (con su etiqueta
  // por estrellas); esto solo recoge la etiqueta afinada por el análisis del
  // texto y el "Lo que más gusta" actualizado. Para cuando la reseña deja de
  // estar 'pending' (más una vuelta extra, porque los agregados del
  // restaurante se recalculan justo después) o se agotan los intentos.
  useEffect(() => {
    if (!analyzingReviewId) return undefined;
    let cancelled = false;
    let attempts = 0;
    let analyzed = false;
    let timer;

    async function tick() {
      attempts += 1;
      try {
        const [rv, asp] = await Promise.all([reviewsApi.listByRestaurant(id), fetchAspects(id)]);
        if (cancelled) return;
        setReviews(rv);
        setAspects(asp);
        const wasAnalyzed = analyzed;
        const status = rv.find((x) => x.id === analyzingReviewId)?.analysis_status;
        analyzed = !!status && status !== 'pending';
        if (wasAnalyzed) {
          setAnalyzingReviewId(null);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (attempts >= ANALYSIS_POLL_MAX_ATTEMPTS && !analyzed) {
        setAnalyzingReviewId(null);
        return;
      }
      timer = setTimeout(tick, ANALYSIS_POLL_MS);
    }

    timer = setTimeout(tick, ANALYSIS_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [analyzingReviewId, id]);

  // El promedio, el conteo y las barras salen de `reviews`, así que agregar la
  // reseña aquí los actualiza al instante; los filtros se limpian para que la
  // nueva quede visible arriba de la lista.
  async function handleReviewCreated(review) {
    setReviews((prev) => [review, ...prev.filter((x) => x.id !== review.id)]);
    setReviewSort('recientes');
    setRatingFilter(0);
    setNewReviewId(review.id);
    setAnalyzingReviewId(review.id);
    try {
      // rating_avg del encabezado (combina Google + GSI) se recalcula al guardar
      setRestaurant(await restaurantsApi.get(id));
    } catch {
      // no crítico
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    setAnalyzingReviewId(null);
    setGalleryPhotos(null);
    setAspects([]);
    setReviewSort('recientes');
    setRatingFilter(0);
    Promise.all([
      restaurantsApi.get(id),
      // Con el menú oculto no se piden datos que no se muestran.
      SHOW_DIGITAL_MENU ? menuApi.listByRestaurant(id) : Promise.resolve([]),
      reviewsApi.listByRestaurant(id),
      restaurantsApi.nearbyParkings(id, 2),
      fetchAspects(id),
      restaurantsApi.photos(id).catch(() => null)
    ])
      .then(([r, m, rv, p, asp, ph]) => {
        setRestaurant(r);
        setMenu(m);
        setReviews(rv);
        setNearbyParkings(p);
        setAspects(asp);
        // Sin fotos de galería se intenta la foto principal (p. ej. una URL
        // manual del admin); si tampoco existe, el carrusel muestra el placeholder.
        const gallery = (ph?.photos ?? []).map(photoUrls.fromApiPath);
        setGalleryPhotos(gallery.length > 0 ? gallery : [photoUrls.main(r.id)]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <RestaurantDetailSkeleton />;
  if (error)
    return (
      <div className="dark-theme">
        <div className="container" style={{ padding: 40 }}>
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
  if (!restaurant) return null;

  const groupedMenu = menu.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="dark-theme">
      <div className="container detail-page fade-in">
        <Link to="/" className="muted detail-back-link">
          ← Volver a la búsqueda
        </Link>

      <div>
        <div className="detail-header-row">
          <div>
            <h1 className="detail-title">{restaurant.name}</h1>
            <p className="muted detail-meta">
              {restaurant.cuisine_type} · {restaurant.neighborhood} ·{' '}
              <PriceIndicator priceRange={restaurant.price_range} />
            </p>
          </div>
          <StarRating value={Number(restaurant.rating_avg)} size={20} />
        </div>

        <div className="detail-badges">
          {!!restaurant.has_wifi && (
            <span className="badge">
              <Wifi size={13} strokeWidth={2.2} aria-hidden="true" />
              Wifi
            </span>
          )}
          <ParkingBadge type={restaurant.parking_type} />
          {!!restaurant.kids_zone && <span className="badge badge-outline">🧒 Zona de niños</span>}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main-col">
          <PhotoGallery
            key={restaurant.id}
            photos={galleryPhotos}
            altPrefix={restaurant.name}
            cuisine={restaurant.cuisine_type}
          />

          {SHOW_DIGITAL_MENU && (
            <section>
              <h2>Menú digital</h2>
              {menu.length === 0 && <p className="muted">Este restaurante aún no ha publicado su menú.</p>}
              {Object.entries(groupedMenu).map(([category, items]) => (
                <div key={category} className="menu-category">
                  <h4 className="menu-category-title">{category}</h4>
                  <div className="menu-items">
                    {items.map((item) => (
                      <div key={item.id} className="menu-item-row">
                        <div>
                          <strong>{item.name}</strong>
                          {item.description && <p className="muted menu-item-desc">{item.description}</p>}
                        </div>
                        <strong className="menu-item-price">${Number(item.price).toLocaleString('es-CO')}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <aside className="detail-aside">
          <div className="card info-card">
            <h4>Información</h4>
            <p className="info-row">
              <strong>Dirección:</strong>
              <br />
              {restaurant.address}
            </p>
            <p className="info-row">
              <strong>Horario:</strong>
              <br />
              {restaurant.opening_hours}
            </p>
            {restaurant.phone && (
              <p className="info-row">
                <strong>Teléfono:</strong>
                <br />
                {restaurant.phone}
              </p>
            )}
            {restaurant.website && (
              <p className="info-row">
                <a href={restaurant.website} target="_blank" rel="noreferrer">
                  Sitio web / redes ↗
                </a>
              </p>
            )}
          </div>

          <div className="location-block">
            <h4>Ubicación y parqueaderos cercanos</h4>
            <RestaurantMap restaurant={restaurant} parkings={nearbyParkings} />
            {nearbyParkings.length === 0 && (
              <p className="muted parking-note">No hay parqueaderos registrados a menos de 2 km.</p>
            )}
          </div>
        </aside>
      </div>

      <section className="reviews-section" id="opiniones">
        <div className="reviews-section-summary">
          <h2>Calificaciones</h2>
          <RatingSummary
            reviews={reviews}
            aspects={aspects}
            selectedRating={ratingFilter}
            onSelectRating={setRatingFilter}
          />
        </div>

        <div className="reviews-section-main">
          <div className="reviews-section-head">
            <h2>Opiniones</h2>
            <span className="muted">
              {reviews.length} {reviews.length === 1 ? 'comentario' : 'comentarios'}
            </span>
          </div>

          {user ? (
            <ReviewForm restaurantId={id} onCreated={handleReviewCreated} />
          ) : (
            <div className="card review-login-prompt">
              <p>
                ¿Ya visitaste este lugar? <Link to="/login">Inicia sesión</Link> para dejar tu opinión.
              </p>
            </div>
          )}

          <ReviewList
            reviews={reviews}
            newReviewId={newReviewId}
            sort={reviewSort}
            onSortChange={setReviewSort}
            ratingFilter={ratingFilter}
            onRatingFilterChange={setRatingFilter}
          />
        </div>
      </section>
      </div>
    </div>
  );
}

function RestaurantDetailSkeleton() {
  return (
    <div className="dark-theme">
    <div className="container detail-page">
      <div className="skeleton-line" style={{ width: 140 }} />

      <div>
        <div className="detail-header-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-line" style={{ width: 260, height: 26 }} />
            <div className="skeleton-line" style={{ width: 200 }} />
          </div>
          <div className="skeleton-line" style={{ width: 90, height: 20 }} />
        </div>

        <div className="detail-badges">
          <div className="skeleton-line" style={{ width: 70, height: 24, borderRadius: 999 }} />
          <div className="skeleton-line" style={{ width: 100, height: 24, borderRadius: 999 }} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main-col">
          <div className="photo-carousel-frame skeleton-block" />
        </div>

        <aside className="detail-aside">
          <div className="skeleton-block" style={{ height: 150 }} />
          <div className="skeleton-block" style={{ height: 180 }} />
        </aside>
      </div>
    </div>
    </div>
  );
}
