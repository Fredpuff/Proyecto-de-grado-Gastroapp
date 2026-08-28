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

const restaurantIcon = pinIcon('🍽️', '#c1552b');
const parkingIcon = pinIcon('🅿️', '#6e7b3d');

export default function RestaurantMap({ restaurant, parkings = [] }) {
  const center = [Number(restaurant.lat), Number(restaurant.lng)];

  return (
    <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: 320, width: '100%' }}>
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
  );
}
