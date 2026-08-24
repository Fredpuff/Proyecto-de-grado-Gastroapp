import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { restaurantsApi } from '../api/resources';
import { useAuth } from '../context/AuthContext';
import ParkingBadge from '../components/ParkingBadge';
import StarRating from '../components/StarRating';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    restaurantsApi
      .list()
      .then((all) => setRestaurants(all.filter((r) => r.owner_id === user.id)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [user.id]);

  async function handleDelete(id, name) {
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await restaurantsApi.remove(id);
      setRestaurants((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="container" style={{ padding: '40px 20px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Mi panel de administración</h1>
          <p className="muted" style={{ margin: 0 }}>Gestiona tus fichas de restaurante y su menú digital.</p>
        </div>
        <Link to="/admin/restaurantes/nuevo" className="btn btn-primary">
          + Nuevo restaurante
        </Link>
      </div>

      {loading && <p className="muted" style={{ marginTop: 24 }}>Cargando...</p>}
      {error && <div className="alert alert-error" style={{ marginTop: 24 }}>{error}</div>}

      {!loading && restaurants.length === 0 && (
        <div className="empty-state">
          <h3>Aún no tienes restaurantes</h3>
          <p>Crea tu primera ficha para empezar a aparecer en las búsquedas.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {restaurants.map((r) => (
          <div
            key={r.id}
            className="card"
            style={{
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <strong>{r.name}</strong>
              <p className="muted" style={{ margin: '2px 0 8px', fontSize: 13.5 }}>
                {r.cuisine_type} · {r.neighborhood} · {r.price_range}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StarRating value={Number(r.rating_avg)} />
                <ParkingBadge type={r.parking_type} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to={`/restaurantes/${r.id}`} className="btn btn-ghost btn-sm">
                Ver ficha
              </Link>
              <Link to={`/admin/restaurantes/${r.id}`} className="btn btn-outline btn-sm">
                Editar
              </Link>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id, r.name)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
