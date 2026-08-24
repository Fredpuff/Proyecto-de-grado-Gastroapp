const LABELS = {
  propio: 'Parqueadero propio',
  convenio: 'Parqueadero convenio',
  publico: 'Parqueadero público',
  no_disponible: 'Sin parqueadero'
};

export default function ParkingBadge({ type }) {
  if (type === 'no_disponible') {
    return <span className="badge badge-outline">🚫 Sin parqueadero</span>;
  }
  return <span className="badge">🅿️ {LABELS[type] || type}</span>;
}
