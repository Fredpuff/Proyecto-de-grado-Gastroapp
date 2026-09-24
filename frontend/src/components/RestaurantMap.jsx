import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PARKING_LABELS = {
  propio: 'Propio',
  convenio: 'Convenio',
  publico: 'Público',
  centro_comercial: 'Centro comercial'
};

function pinIcon(emoji, bg) {
  return L.divIcon({
    html: `<div style="
      width: 30px; height: 30px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg); background:${bg};
      display:flex; align-items:center; justify-content:center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      border: 2px solid #fff;">
      <span style="transform: rotate(45deg); font-size:15px;">${emoji}</span>
    </div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

const restaurantIcon = pinIcon('🍽️', '#ff5f6d');
const parkingIcon = pinIcon('🅿️', '#6e7b3d');

export default function RestaurantMap({ restaurant, parkings = [] }) {
  const center = [Number(restaurant.lat), Number(restaurant.lng)];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${center[0]},${center[1]}`;

  return (
    <div>
      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: 280, width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center} icon={restaurantIcon}>
            <Popup>
              <strong>{restaurant.name}</strong>
              <br />
              {restaurant.address}
            </Popup>
          </Marker>

          {parkings.map((p) => (
            <Marker key={p.id} position={[Number(p.lat), Number(p.lng)]} icon={parkingIcon}>
              <Popup>
                <strong>{p.name}</strong>
                <br />
                {PARKING_LABELS[p.type] || p.type}
                {p.distance_km !== undefined && (
                  <>
                    <br />
                    {p.distance_km} km del restaurante
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginTop: 8,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-primary)'
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Ver en Google Maps
      </a>
    </div>
  );
}
