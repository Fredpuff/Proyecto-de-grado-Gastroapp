import { NEIGHBORHOODS, PRICE_RANGES } from '../constants';

export default function SearchFilters({ filters, cuisines, onChange, onReset }) {
  function set(field, value) {
    onChange({ ...filters, [field]: value });
  }

  const selectedCuisines = Array.isArray(filters.cuisine)
    ? filters.cuisine
    : filters.cuisine
      ? [filters.cuisine]
      : [];

  function toggleCuisine(c) {
    const next = selectedCuisines.includes(c)
      ? selectedCuisines.filter((x) => x !== c)
      : [...selectedCuisines, c];
    set('cuisine', next);
  }

  return (
    <div className="filters-bar">
      <div className="field filters-bar-search">
        <label htmlFor="q">Buscar</label>
        <input
          id="q"
          type="text"
          placeholder="Nombre o tipo de cocina..."
          value={filters.q || ''}
          onChange={(e) => set('q', e.target.value)}
        />
      </div>

      <div className="field filters-bar-select">
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

      <div className="field filters-bar-select">
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

      <div className="filters-bar-toggles">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.wifi === 'true'}
            onChange={(e) => set('wifi', e.target.checked ? 'true' : '')}
          />
          📶 Wifi
        </label>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.parking === 'true'}
            onChange={(e) => set('parking', e.target.checked ? 'true' : '')}
          />
          🅿️ Parqueadero
        </label>
      </div>

      <button className="btn btn-ghost btn-sm filters-bar-reset" onClick={onReset} type="button">
        Limpiar filtros
      </button>

      {cuisines.length > 0 && (
        <div className="filters-bar-cuisine-row">
          <span className="filters-bar-cuisine-label">Cocina:</span>
          <div className="cuisine-pills">
            {cuisines.map((c) => (
              <label key={c} className="filter-toggle filter-toggle-sm">
                <input
                  type="checkbox"
                  checked={selectedCuisines.includes(c)}
                  onChange={() => toggleCuisine(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
