# GSI — Gastronomy Search Intelligence

Plataforma de búsqueda de restaurantes gourmet en Villavicencio, Colombia.

**Fase 1 (actual, ~40%)**: base funcional — modelo de datos, CRUD, búsqueda con
filtros, geolocalización estática (Haversine) y UI. **Sin IA, sin NLP, sin
web scraping** — eso llega en una fase posterior.

## Estructura

```
/backend   API REST (Node.js + Express + MySQL, auth JWT)
/frontend  React (Vite)
```

## 1. Backend

### Requisitos
- Node.js 18+
- MySQL 8+ corriendo localmente (o accesible por red)

### Configuración

```bash
cd backend
npm install
cp .env.example .env
```

Edita `backend/.env` con tus credenciales de MySQL:

```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=gsi_db
JWT_SECRET=cambia_esto_por_un_secreto_largo
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

### Crear la base de datos y cargar datos de ejemplo

Opción A — script automático (crea la BD, aplica el schema y el seed):

```bash
npm run seed
```

Opción B — manual con el cliente `mysql`:

```bash
mysql -u root -p < sql/schema.sql
mysql -u root -p < sql/seed.sql
```

El seed crea 9 restaurantes de ejemplo en Centro Histórico, Barzal, La Rosita
y Villacentro, con menús, parqueaderos cercanos y reseñas. Usuarios de prueba:

| Rol     | Email              | Password     |
|---------|--------------------|--------------|
| admin   | admin1@gsi.test    | Admin123!    |
| admin   | admin2@gsi.test    | Admin123!    |
| admin   | admin3@gsi.test    | Admin123!    |
| cliente | cliente1@gsi.test  | Cliente123!  |
| cliente | cliente2@gsi.test  | Cliente123!  |

Cada admin es dueño de 2-3 restaurantes (ver `owner_id` en `sql/seed.sql`) y
solo puede editar/eliminar los suyos.

### Levantar el servidor

```bash
npm run dev    # con nodemon, recarga automática
# o
npm start
```

API disponible en `http://localhost:4000/api`. Healthcheck: `GET /api/health`.

### Endpoints principales

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/restaurants?q=&cuisine=&priceRange=&neighborhood=&parking=true&wifi=true`
- `GET /api/restaurants/:id`
- `POST|PUT|DELETE /api/restaurants/:id` (admin, solo dueño en update/delete)
- `GET /api/restaurants/:id/nearby-parkings?radiusKm=1.5` (Haversine)
- `GET|POST /api/restaurants/:id/menu`, `PUT|DELETE /api/menu/:id` (admin dueño)
- `GET|POST /api/restaurants/:id/reviews` (usuario logueado)
- `GET|POST /api/parkings`, `PUT|DELETE /api/parkings/:id` (admin)

## 2. Frontend

### Requisitos
- Node.js 18+
- Backend corriendo (ver arriba)

### Configuración y arranque

```bash
cd frontend
npm install
cp .env.example .env   # ajusta VITE_API_URL si el backend no está en localhost:4000
npm run dev
```

App disponible en `http://localhost:5173`.

### Qué incluye

- **Inicio**: buscador + filtros combinables (tipo de cocina, zona, precio, wifi,
  parqueadero) sobre `GET /api/restaurants`, tarjetas de resultado con rating,
  badges de wifi/parqueadero y precio.
- **Ficha de restaurante** (`/restaurantes/:id`): menú digital agrupado por
  categoría, horario, contacto, mapa (Leaflet + OpenStreetMap) con el
  restaurante y sus parqueaderos cercanos calculados con Haversine, y sección
  de reseñas con formulario para usuarios logueados.
- **Auth** (`/login`, `/registro`): JWT guardado en `localStorage`, con
  registro como cliente o administrador de restaurante.
- **Panel de administración** (`/admin`, solo rol `admin`): CRUD de las
  fichas propias (creación, edición, borrado) y gestión de su menú digital
  (`/admin/restaurantes/:id`).
- Diseño responsive con paleta cálida (terracota / crema / verde oliva),
  tipografía Fraunces + Work Sans, sin frameworks de componentes — CSS plano
  con variables.

### Notas
- El frontend no calcula el promedio de calificación de un restaurante: ese
  campo se edita manualmente desde el panel de administrador, tal como se
  almacena en el backend.
- El mapa usa tiles públicos de OpenStreetMap (sin API key) — solo requiere
  conexión a internet en el navegador.

## Notas de alcance (Fase 1)

- `rating_avg` de cada restaurante se carga **manualmente** en el seed/admin,
  no se calcula a partir de las reseñas todavía.
- Las reseñas solo se almacenan (texto + rating 1-5): no hay análisis de
  sentimiento ni resúmenes automáticos.
- La cercanía de parqueaderos se calcula con la fórmula de Haversine sobre
  coordenadas estáticas, sin IA ni servicios externos de mapas para el cálculo.
