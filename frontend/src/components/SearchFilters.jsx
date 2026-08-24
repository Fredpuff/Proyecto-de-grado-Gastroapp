import { NEIGHBORHOODS, PRICE_RANGES } from '../constants';

export default function SearchFilters({ filters, cuisines, onChange, onReset }) {
  function set(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          alignItems: 'end'
        }}
      >
        <div className="field" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            type="text"
            placeholder="Nombre o tipo de cocina..."
            value={filters.q || ''}
            onChange={(e) => set('q', e.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="cuisine">Tipo de cocina</label>
          <select id="cuisine" value={filters.cuisine || ''} onChange={(e) => set('cuisine', e.target.value)}>
            <option value="">Todas</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="neighborhood">Zona</label>
          <select
            id="neighborhood"
            value={filters.neighborhood || ''}
            onChange={(e) => set('neighborhood', e.target.value)}
          >
            <option value="">Todas</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="priceRange">Precio</label>
          <select
            id="priceRange"
            value={filters.priceRange || ''}
            onChange={(e) => set('priceRange', e.target.value)}
          >
            <option value="">Todos</option>
            {PRICE_RANGES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 42 }}>
          <label className="field-row" style={{ fontSize: 14 }}>
            <input
              type="checkbox"
              checked={filters.wifi === 'true'}
              onChange={(e) => set('wifi', e.target.checked ? 'true' : '')}
            />
            📶 Wifi
          </label>
          <label className="field-row" style={{ fontSize: 14 }}>
            <input
              type="checkbox"
              checked={filters.parking === 'true'}
              onChange={(e) => set('parking', e.target.checked ? 'true' : '')}
            />
            🅿️ Parqueadero
          </label>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={onReset} type="button">
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
