import { useEffect, useState } from 'react';
import { menuApi } from '../api/resources';
import { MENU_CATEGORIES } from '../constants';

const emptyItem = { name: '', description: '', price: '', category: MENU_CATEGORIES[0] };

export default function AdminMenuManager({ restaurantId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    menuApi
      .listByRestaurant(restaurantId)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [restaurantId]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyItem);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = { ...form, price: Number(form.price) };
    try {
      if (editingId) {
        const updated = await menuApi.update(editingId, payload);
        setItems((prev) => prev.map((it) => (it.id === editingId ? updated : it)));
      } else {
        const created = await menuApi.create(restaurantId, payload);
        setItems((prev) => [...prev, created]);
      }
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este plato del menú?')) return;
    try {
      await menuApi.remove(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted">Cargando menú...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {items.length === 0 && <p className="muted">Aún no has agregado platos.</p>}
          {items.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
            >
              <div>
                <strong>{item.name}</strong>{' '}
                <span className="muted" style={{ fontSize: 12.5 }}>· {item.category}</span>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                  ${Number(item.price).toLocaleString('es-CO')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => startEdit(item)}>
                  Editar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>{editingId ? 'Editar plato' : 'Agregar plato'}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Nombre</label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Precio (COP)</label>
            <input type="number" min="0" required value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Categoría</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {MENU_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Descripción (opcional)</label>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar al menú'}
          </button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
