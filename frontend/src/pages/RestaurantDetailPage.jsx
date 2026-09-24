import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { restaurantsApi, menuApi, reviewsApi } from '../api/resources';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ParkingBadge from '../components/ParkingBadge';
import PriceIndicator from '../components/PriceIndicator';
import RestaurantMap from '../components/RestaurantMap';
import ReviewList from '../components/ReviewList';
import ReviewForm from '../components/ReviewForm';
import ReviewInsights from '../components/ReviewInsights';
import RatingSummary from '../components/RatingSummary';
import PhotoGallery from '../components/PhotoGallery';

const ANALYSIS_POLL_MS = 4000;
const ANALYSIS_POLL_MAX_ATTEMPTS = 5;

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [nearbyParkings, setNearbyParkings] = useState([]);
  const [ratingSummaryData, setRatingSummaryData] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newReviewId, setNewReviewId] = useState(null);
  const [analyzingReviewId, setAnalyzingReviewId] = useState(null);
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0);

  useEffect(() => {
    if (!newReviewId) return undefined;
    const timer = setTimeout(() => setNewReviewId(null), 300);
    return () => clearTimeout(timer);
  }, [newReviewId]);

  // Polling corto tras crear una reseña: refresca lista, rating y análisis
  // cada ANALYSIS_POLL_MS hasta que la reseña tenga sentimiento (más una
  // vuelta extra, porque los agregados del restaurante se recalculan justo
  // después) o se agoten los intentos (reseña omitida o análisis fallido).
  useEffect(() => {
    if (!analyzingReviewId) return undefined;
    let cancelled = false;
    let attempts = 0;
    let analyzed = false;
    let timer;

    async function tick() {
      attempts += 1;
      try {
        const [rv, r] = await Promise.all([reviewsApi.listByRestaurant(id), restaurantsApi.get(id)]);
        if (cancelled) return;
        setReviews(rv);
        setRestaurant(r);
        setInsightsRefreshKey((k) => k + 1);
        const wasAnalyzed = analyzed;
        analyzed = !!rv.find((x) => x.id === analyzingReviewId)?.sentiment;
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

  async function handleReviewCreated(review) {
    setReviews((prev) => [review, ...prev.filter((x) => x.id !== review.id)]);
    setNewReviewId(review.id);
    setAnalyzingReviewId(review.id);
    try {
      const [r, rs] = await Promise.all([
        restaurantsApi.get(id),
        restaurantsApi.ratingSummary(id).catch(() => null)
      ]);
      setRestaurant(r);
      if (rs) setRatingSummaryData(rs);
    } catch {
      // no crítico: el polling lo vuelve a intentar
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    setAnalyzingReviewId(null);
    setHeroImgFailed(false);
    setGalleryPhotos(null);
    Promise.all([
      restaurantsApi.get(id),
      menuApi.listByRestaurant(id),
      reviewsApi.listByRestaurant(id),
      restaurantsApi.nearbyParkings(id, 2),
      restaurantsApi.ratingSummary(id).catch(() => null),
      restaurantsApi.photos(id).catch(() => null)
    ])
      .then(([r, m, rv, p, rs, ph]) => {
        setRestaurant(r);
        setMenu(m);
        setReviews(rv);
        setNearbyParkings(p);
        setRatingSummaryData(rs);
        setGalleryPhotos(ph?.photos ?? []);
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

        {galleryPhotos && galleryPhotos.length > 0 ? (
          <PhotoGallery photos={galleryPhotos} altPrefix={restaurant.name} />
        ) : (
          restaurant.image_url && !heroImgFailed && (
            <div className="restaurant-detail-hero">
              <img
                src={restaurant.image_url}
                alt={restaurant.name}
                loading="lazy"
                onError={() => setHeroImgFailed(true)}
              />
            </div>
          )
        )}

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

          <ReviewInsights restaurantId={id} refreshKey={insightsRefreshKey} />

          <section>
            <h2>Reseñas ({reviews.length})</h2>
            <div className="reviews-list">
              {user ? (
                <ReviewForm restaurantId={id} onCreated={handleReviewCreated} />
              ) : (
                <p className="muted">
                  <Link to="/login">Inicia sesión</Link> para dejar tu reseña.
                </p>
              )}
              <ReviewList reviews={reviews} newReviewId={newReviewId} />
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          {ratingSummaryData && (
            <RatingSummary
              ratingAvg={ratingSummaryData.ratingAvg}
              totalCount={ratingSummaryData.totalCount}
              breakdown={ratingSummaryData.breakdown}
            />
          )}

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
          <section>
            <div className="skeleton-line" style={{ width: 140, height: 20, marginBottom: 16 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-line" style={{ width: `${85 - i * 8}%` }} />
              ))}
            </div>
          </section>

          <section>
            <div className="skeleton-line" style={{ width: 120, height: 20, marginBottom: 16 }} />
            <div className="skeleton-block" style={{ height: 90 }} />
          </section>
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
