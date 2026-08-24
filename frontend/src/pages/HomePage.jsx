import { useEffect, useMemo, useState } from 'react';
import SearchFilters from '../components/SearchFilters';
import RestaurantCard from '../components/RestaurantCard';
import { restaurantsApi } from '../api/resources';

export default function HomePage() {
  const [filters, setFilters] = useState({});
  const [debouncedFilters, setDebouncedFilters] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    setError('');
    restaurantsApi
      .list(debouncedFilters)
      .then(setRestaurants)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [debouncedFilters]);

  const cuisines = useMemo(() => {
    const set = new Set(restaurants.map((r) => r.cuisine_type));
    return Array.from(set).sort();
  }, [restaurants]);

  return (
    <div>
      <section
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-olive-light))',
          padding: '56px 0 40px'
        }}
      >
        <div className="container">
          <h1 style={{ fontSize: 36, maxWidth: 640 }}>Descubre los mejores sabores de Villavicencio</h1>
          <p className="muted" style={{ maxWidth: 560, fontSize: 16 }}>
            Restaurantes gourmet en Centro Histórico, Barzal, La Rosita y Villacentro — con menú digital,
            parqueaderos cercanos y reseñas reales.
          </p>
        </div>
      </section>

      <div className="container" style={{ marginTop: -30, paddingBottom: 60 }}>
        <SearchFilters filters={filters} cuisines={cuisines} onChange={setFilters} onReset={() => setFilters({})} />

        <div style={{ marginTop: 28 }}>
          {loading && <p className="muted">Buscando restaurantes...</p>}
          {error && <div className="alert alert-error">{error}</div>}

          {!loading && !error && restaurants.length === 0 && (
            <div className="empty-state">
              <h3>No encontramos restaurantes con esos filtros</h3>
              <p>Intenta ajustar la búsqueda o limpiar los filtros.</p>
            </div>
          )}

          {!loading && restaurants.length > 0 && (
            <>
              <p className="muted" style={{ marginBottom: 16 }}>
                {restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''} encontrado
                {restaurants.length !== 1 ? 's' : ''}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 20
                }}
              >
                {restaurants.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
