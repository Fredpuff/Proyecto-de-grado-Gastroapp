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
      <section className="home-hero">
        <span className="home-hero-blob home-hero-blob-1" aria-hidden="true" />
        <span className="home-hero-blob home-hero-blob-2" aria-hidden="true" />
        <div className="container home-hero-content">
          <h1 className="home-hero-title">Descubre los mejores sabores de Villavicencio</h1>
          <p className="muted home-hero-subtitle">
            Restaurantes gourmet en Centro Histórico, Barzal, La Rosita y Villacentro — con menú digital,
            parqueaderos cercanos y reseñas reales.
          </p>
        </div>
      </section>

      <div className="container home-content">
        <SearchFilters filters={filters} cuisines={cuisines} onChange={setFilters} onReset={() => setFilters({})} />

        <div className="home-results">
          {loading && <p className="muted fade-in">Buscando restaurantes...</p>}
          {error && <div className="alert alert-error fade-in">{error}</div>}

          {!loading && !error && restaurants.length === 0 && (
            <div className="empty-state fade-in">
              <h3>No encontramos restaurantes con esos filtros</h3>
              <p>Intenta ajustar la búsqueda o limpiar los filtros.</p>
            </div>
          )}

          {!loading && restaurants.length > 0 && (
            <div className="fade-in">
              <p className="muted home-results-count">
                {restaurants.length} restaurante{restaurants.length !== 1 ? 's' : ''} encontrado
                {restaurants.length !== 1 ? 's' : ''}
              </p>
              <div className="restaurant-grid">
                {restaurants.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
