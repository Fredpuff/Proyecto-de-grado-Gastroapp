import { SquareParking, Ban } from 'lucide-react';

const LABELS = {
  propio: 'Parqueadero propio',
  convenio: 'Parqueadero convenio',
  publico: 'Parqueadero público',
  no_disponible: 'Sin parqueadero'
};

export default function ParkingBadge({ type }) {
  if (type === 'no_disponible') {
    return (
      <span className="badge badge-outline">
        <Ban size={13} strokeWidth={2.2} aria-hidden="true" />
        Sin parqueadero
      </span>
    );
  }
  return (
    <span className="badge">
      <SquareParking size={13} strokeWidth={2.2} aria-hidden="true" />
      {LABELS[type] || type}
    </span>
  );
}
