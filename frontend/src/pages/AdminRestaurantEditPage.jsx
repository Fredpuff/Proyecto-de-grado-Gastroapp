import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { restaurantsApi } from '../api/resources';
import { NEIGHBORHOODS, PRICE_RANGES, PARKING_TYPES } from '../constants';
import AdminMenuManager from '../components/AdminMenuManager';

const emptyForm = {
  name: '',
  address: '',
  neighborhood: NEIGHBORHOODS[0],
  cuisine_type: '',
  price_range: '$$',
  opening_hours: '',
  phone: '',
  website: '',
  has_wifi: false,
  parking_type: 'no_disponible',
  kids_zone: false,
  rating_avg: 0,
  image_url: '',
  lat: '',
  lng: ''
};

export default function AdminRestaurantEditPage() {
  const { id } = useParams();
  const isNew = id === 'nuevo';
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isNew) return;
    restaurantsApi
      .get(id)
      .then((r) =>
        setForm({
          ...r,
          rating_avg: Number(r.rating_avg),
          lat: r.lat,
          lng: r.lng,
          phone: r.phone || '',
          website: r.website || '',
          image_url: r.image_url || ''
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const payload = {
      ...form,
      rating_avg: Number(form.rating_avg),
      lat: Number(form.lat),
      lng: Number(form.lng),
      phone: form.phone || null,
      website: form.website || null,
      image_url: form.image_url || null
    };

    try {
      if (isNew) {
        const created = await restaurantsApi.create(payload);
        navigate(`/admin/restaurantes/${created.id}`, { replace: true });
      } else {
        await restaurantsApi.update(id, payload);
        setSuccess('Cambios guardados.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="container" style={{ padding: 40 }}>Cargando...</div>;

  return (
    <div className="container" style={{ padding: '32px 20px 60px', maxWidth: 760 }}>
      <Link to="/admin" className="muted" style={{ fontSize: 14 }}>
        ← Volver a mi panel
      </Link>

      <h1>{isNew ? 'Nuevo restaurante' : `Editar: ${form.name}`}</h1>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 32 }}>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label>Nombre</label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label>Dirección</label>
            <input required value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Zona / barrio</label>
            <select value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)}>
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Tipo de cocina</label>
            <input required value={form.cuisine_type} onChange={(e) => set('cuisine_type', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Rango de precios</label>
            <select value={form.price_range} onChange={(e) => set('price_range', e.target.value)}>
              {PRICE_RANGES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Calificación promedio (0-5)</label>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={form.rating_avg}
              onChange={(e) => set('rating_avg', e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label>Horario de atención</label>
            <input
              required
              placeholder="Lun-Sáb 12:00-22:00, Dom 12:00-16:00"
              value={form.opening_hours}
              onChange={(e) => set('opening_hours', e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Teléfono</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Web / redes sociales</label>
            <input value={form.website} onChange={(e) => set('website', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Parqueadero</label>
            <select value={form.parking_type} onChange={(e) => set('parking_type', e.target.value)}>
              {PARKING_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Imagen (URL, opcional)</label>
            <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Latitud</label>
            <input
              type="number"
              step="0.000001"
              required
              value={form.lat}
              onChange={(e) => set('lat', e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Longitud</label>
            <input
              type="number"
              step="0.000001"
              required
              value={form.lng}
              onChange={(e) => set('lng', e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label className="field-row" style={{ fontSize: 14 }}>
              <input type="checkbox" checked={form.has_wifi} onChange={(e) => set('has_wifi', e.target.checked)} />
              📶 Tiene wifi
            </label>
            <label className="field-row" style={{ fontSize: 14 }}>
              <input type="checkbox" checked={form.kids_zone} onChange={(e) => set('kids_zone', e.target.checked)} />
              🧒 Zona de niños
            </label>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 18 }}>
          {saving ? 'Guardando...' : isNew ? 'Crear restaurante' : 'Guardar cambios'}
        </button>
      </form>

      {!isNew && (
        <section>
          <h2>Menú digital</h2>
          <AdminMenuManager restaurantId={id} />
        </section>
      )}
    </div>
  );
}
