# GSI — Backend

API REST (Node.js + Express + MySQL/TiDB). Para la visión general del proyecto,
arranque del servidor y frontend, ver el [`README.md`](../README.md) de la raíz.

---

## Recolección de datos de restaurantes (`npm run collect-data`)

Script: [`scripts/collectRestaurantData.js`](scripts/collectRestaurantData.js)

Obtiene información **real y verificable** de restaurantes gourmet, cafés y
afines en Villavicencio y la carga en la tabla `restaurants` (la misma que
alimenta el chat de recomendaciones `POST /api/chat/recommend`). Implementa la
**ficha de recolección de datos** del anteproyecto (Capítulo III, *Instrumentos
y técnicas de recolección*).

### Población objetivo

Establecimientos de comida gourmet (restaurantes, cafés y afines) ubicados en
los sectores **Centro Histórico, Barzal, La Rosita y Villacentro** de
Villavicencio, con presencia online verificable (web propia, redes sociales o
listados en plataformas de reseñas). Los resultados cuya dirección no calza con
ninguno de los 4 sectores se marcan como zona **`Sin clasificar`** (no se
fuerzan a una zona).

### Campos que captura por establecimiento

| Ficha del anteproyecto | Origen |
|---|---|
| Nombre | Google Places |
| Dirección + zona | Google Places (`formatted_address`), zona detectada por texto |
| Tipo(s) de cocina | Inferido de nombre/`types`; `NULL` si no hay señal |
| Rango de precios (Económico / Medio / Gourmet) | `price_level` de Google; si no viene, `NULL` (se completa a mano) |
| Horarios de atención | Google Places (`opening_hours.weekday_text`) |
| Servicios (parqueadero, wifi, zona de niños) | Wifi y zona de niños por scraping del sitio propio; parqueadero queda `no_disponible` salvo carga manual |
| Calificación numérica (Google Maps) | Google Places (`rating`) |
| Número de reseñas | Google Places (`user_ratings_total`) |
| Enlace a presencia web principal | Google Places (`website`, o `url` de la ficha de Maps) |

> **No se inventan datos.** Si una fuente no entrega un campo, se guarda `NULL`
> para completarlo manualmente después.

### Selección de los mejores (top 25)

De los establecimientos que cumplen el criterio de inclusión, solo se
scrapean y se guardan en la base de datos los **25 mejores** (configurable),
para no llenar la tabla con las ~260+ fichas que trae Google Places por las 4
zonas. El orden lo decide un **promedio bayesiano de rating + nº de
reseñas** (estilo IMDb): evita que un 5.0 con 1 reseña le gane a un 4.6 con
500. `C` (rating promedio) y `m` (reseñas promedio) se calculan con los
propios candidatos de cada corrida, no son un número fijo en el código.

```bash
npm run collect-data              # top 25 (por defecto)
node scripts/collectRestaurantData.js --top=40   # top 40
node scripts/collectRestaurantData.js --top=0    # sin límite: todos los que cumplan inclusión y tengan rating
```

Los que cumplen inclusión pero no entran al top (o no tienen rating de Google
para poder rankearse) quedan registrados en `reporte-recoleccion.json` con su
motivo, pero no se scrapean ni se guardan. Re-ejecutar el script no borra de
la BD restaurantes que hayan quedado antes en el top y ahora ya no —
solo controla qué se sigue actualizando automáticamente.

### Calificación combinada (estrellas)

El `rating_avg` que ve la app **no es solo el rating de Google** congelado en
la recolección: es un promedio ponderado entre el rating de Google
(`google_rating` × `google_reviews_total`, como si cada reseña de Google
valiera un voto) y las reseñas reales que los usuarios dejan en la app
(tabla `reviews`). Lo recalcula `src/utils/ratingAvg.js`:

- Cada vez que este script inserta/actualiza un restaurante (mezcla el rating
  fresco de Google con las reseñas de usuarios que ya existan).
- Cada vez que un usuario deja una reseña en la app (`POST
  /api/restaurants/:id/reviews`), sin esperar a la próxima recolección.

Si un restaurante no tiene reseñas de Google ni de usuarios (p. ej. una ficha
cargada a mano y aún sin actividad), se conserva el `rating_avg` que ya
tenía en vez de ponerlo en 0.

### Fuentes

1. **Google Places API** (principal): `Text Search` con consultas del tipo
   `restaurante gourmet <zona> Villavicencio` (+ `café <zona> Villavicencio`)
   para las 4 zonas, y `Place Details` por cada resultado. Con rate limiting,
   reintentos y backoff exponencial.
2. **Scraping complementario** (solo si el restaurante tiene web propia
   detectada en el paso 1): `cheerio` para sitios estáticos, `puppeteer` como
   fallback si el contenido carga por JS. Respeta `robots.txt`
   (`robots-parser`), usa un User-Agent identificable y espera 2–3 s entre
   requests. Extrae menú con precios (→ `menu_items`), wifi y zona de niños por
   palabras clave, y rango de precios si el sitio lo publica.

> **No se scrapea Google Maps ni TripAdvisor.** Esos datos entran únicamente por
> la API oficial de Google Places; el scraping es exclusivo de las páginas
> propias de cada restaurante.

---

### 1. Obtener una clave de Google Places API

1. Entra a <https://console.cloud.google.com/> e inicia sesión.
2. Crea (o selecciona) un proyecto.
3. **APIs y servicios → Biblioteca** → busca **"Places API"** → **Habilitar**.
   (Es la Places API "clásica"/legacy, que es la que usa este script.)
4. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
5. Copia la clave. Recomendado: en la clave, **Restricciones de API →
   Restringir clave → Places API**.
6. Necesitas una **cuenta de facturación** asociada al proyecto (Google exige
   tarjeta aunque haya cupo gratuito mensual). Un barrido completo de las 4
   zonas hace ~8 Text Search + ~100–200 Place Details, muy por debajo del cupo
   gratuito.

### 1b. Restringir la API key de fotos (recomendado)

Las URLs de fotos (`image_url`) que ven los restaurantes en el navegador
llevan la API key incrustada (así lo exige la Photo Media API de Google). Si
usas la misma clave `GOOGLE_PLACES_API_KEY` del paso 1, esa key queda visible
en el HTML del frontend para cualquiera que abra las herramientas de
desarrollador. Para evitarlo, usa **una segunda clave, solo para fotos**,
restringida a tu(s) dominio(s):

1. En el mismo proyecto de Google Cloud, ve a **APIs y servicios →
   Credenciales → Crear credenciales → Clave de API**. Te da una clave nueva.
2. Haz clic en esa clave nueva para editarla. En **Restricciones de
   aplicación**, elige **Sitios web (HTTP referrer)**.
3. Agrega como referrers los orígenes desde donde se va a ver la app:
   - `http://localhost:5173/*` (desarrollo)
   - `https://tu-dominio-de-produccion.com/*` (cuando publiques el frontend)
4. En **Restricciones de API**, restríngela a **Places API**.
5. Guarda. Copia esa clave y pégala en `backend/.env` como
   `GOOGLE_PLACES_PHOTO_KEY=`.
6. **No** le pongas restricción de HTTP referrer a `GOOGLE_PLACES_API_KEY`
   (la del paso 1): esa la usa el script desde Node, sin navegador, así que
   nunca manda un header `Referer` y Google le rechazaría todas las
   peticiones. Esa déjala sin restringir o restríngela por IP si tu servidor
   tiene IP fija.
7. Vuelve a correr `npm run collect-data` para que los restaurantes ya
   guardados actualicen su `image_url` con la nueva clave (los que se
   insertaron antes de este cambio todavía tienen la key del servidor
   incrustada hasta que se recolecten de nuevo).

Si `GOOGLE_PLACES_PHOTO_KEY` no está en `.env`, el script sigue funcionando:
usa `GOOGLE_PLACES_API_KEY` para las fotos también, solo que sin la
protección de referrer.

### 2. Configurar el `.env`

En `backend/.env` (cópialo de `.env.example` si no existe) pega la clave:

```
GOOGLE_PLACES_API_KEY=AIza....tu_clave....
```

### 3. Instalar dependencias

```bash
cd backend
npm install
```

Esto instala `cheerio` y `robots-parser`. `puppeteer` está como dependencia
**opcional**: si su descarga falla, el script igual corre (solo pierde el
fallback para sitios que cargan por JS). Para forzarlo: `npm i puppeteer`.

### 4. Ejecutar

**Paso 1 — validar qué trae Google Places, sin tocar la base de datos:**

```bash
npm run collect-data:places
```

Imprime una tabla de **restaurantes encontrados por zona**, cuántos cumplen el
criterio de inclusión (presencia online verificable) y cuántos tienen web
propia, además del detalle por restaurante (rating, nº de reseñas, precio, web).
No escribe nada en la BD ni hace scraping. Genera
`scripts/output/reporte-recoleccion.json` con ese resumen.

**Paso 2 — recolección completa (Places + scraping + guardado):**

```bash
npm run collect-data
```

Hace, en orden: Google Places → migración de esquema (idempotente) → scraping de
los sitios propios → `UPSERT` en `restaurants` (por `google_place_id`, y si no,
por `nombre + dirección`) → inserta el menú extraído en `menu_items` (solo si el
restaurante aún no tiene ítems) → escribe el reporte final.

Es **re-ejecutable sin duplicar**: vuelve a correrlo cuando quieras para
refrescar ratings y nº de reseñas.

#### Flags útiles

| Flag | Efecto |
|---|---|
| `--dry-run` | Solo Google Places, sin BD ni scraping (= `collect-data:places`). |
| `--no-scraping` | Google Places + guardado en BD, sin scraping. |
| `--limit=N` | Máximo de fichas (`Place Details`) por zona. Útil para no gastar cuota mientras pruebas. |
| `--zone="Barzal"` | Procesa solo esa zona (repetible). |
| `--top=N` | Cuántos "mejores" (rating + nº reseñas) se scrapean/guardan. Por defecto 25; `--top=0` = sin límite. |

Ejemplo: `node scripts/collectRestaurantData.js --no-scraping --limit=10`

---

### Cambios de esquema que aplica el script

Migración documentada en
[`sql/migrations/2026-08-27_recoleccion_datos.sql`](sql/migrations/2026-08-27_recoleccion_datos.sql).
El script la aplica solo si falta algo (revisa `INFORMATION_SCHEMA`):

- `restaurants.data_source` `VARCHAR(32)` — `'manual' | 'google_places' | 'google_places+scraping'`.
- `restaurants.google_place_id`, `google_rating`, `google_reviews_total`,
  `google_maps_url`, `collected_at`.
- Índice único `uq_google_place_id` para el `UPSERT`.
- `cuisine_type`, `opening_hours`, `price_range` pasan a aceptar `NULL`.
- `neighborhood` gana el valor `'Sin clasificar'`.
- `menu_items.source` `VARCHAR(20)` — `'manual' | 'scraping'`.

### Reporte metodológico

`scripts/output/reporte-recoleccion.json` — resumen para citar como evidencia de
la técnica de recolección (censo / muestreo exhaustivo) en el documento del
proyecto: totales por zona, cuántos cumplieron el criterio de inclusión, cuántos
tuvieron scraping exitoso, cuáles fallaron y por qué, y la ficha resultante de
cada establecimiento.
