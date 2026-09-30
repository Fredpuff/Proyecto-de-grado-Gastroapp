'use strict';

// Proxy de fotos de Google Places con caché en disco.
//
// El navegador nunca habla con Google: pide /api/restaurants/:id/image o
// /api/restaurants/:id/photos/:index, el backend descarga la foto UNA vez con
// la key (en el header, nunca en la URL), la guarda en backend/storage/photos/
// y de ahí en adelante la sirve desde disco. Así no se gasta la cuota gratuita
// en cada visita y la key no queda visible para nadie.
//
// Los "photo names" de Places vencen: si Google responde que la foto ya no es
// válida, se vuelven a pedir los nombres UNA vez (restaurant_photos_cache) y se
// reintenta. Los fallos se recuerdan un rato en memoria para no reintentar en
// bucle cada vez que alguien carga la página.

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'photos');
const PLACES_BASE = 'https://places.googleapis.com/v1';
const MAX_WIDTH_PX = 800;
const MAX_PHOTOS = 10;
const NAMES_CACHE_DAYS = 30;
const FAILURE_TTL_MS = 60 * 60 * 1000;
const GOOGLE_TIMEOUT_MS = 15000;

const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const TYPE_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]));

const failures = new Map(); // `${id}-${index}` -> { at, reason }
const nameFailures = new Map(); // restaurantId -> { at, reason } del último fallo de Places
const inFlight = new Map(); // `${id}-${index}` -> Promise

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY;
}

function isGooglePhotoUrl(url) {
  return typeof url === 'string' && /googleapis\.com/i.test(url);
}

function ensureStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

class PhotoError extends Error {
  constructor(message, { expired = false } = {}) {
    super(message);
    this.expired = expired;
  }
}

async function googleFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey() }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function googleError(res) {
  const body = await res.json().catch(() => null);
  const status = body?.error?.status || `HTTP ${res.status}`;
  const message = body?.error?.message || '';
  // Photo name vencido: 400 INVALID_ARGUMENT "photo resource ... invalid" o 404
  const expired = res.status === 404 || (res.status === 400 && /photo resource|not found/i.test(message));
  return new PhotoError(`${res.status} ${status}${message ? `: ${message}` : ''}`, { expired });
}

// Busca en disco la foto ya descargada (cualquier extensión soportada).
async function findOnDisk(restaurantId, index) {
  for (const ext of Object.values(EXT_BY_TYPE)) {
    const file = path.join(STORAGE_DIR, `${restaurantId}-${index}.${ext}`);
    try {
      await fs.promises.access(file);
      return { file, contentType: TYPE_BY_EXT[ext] };
    } catch {
      // sigue con la siguiente extensión
    }
  }
  return null;
}

async function fetchPlacePhotoNames(placeId) {
  const res = await googleFetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}?fields=photos`);
  if (!res.ok) throw await googleError(res);
  const data = await res.json();
  return (data.photos || []).map((p) => p.name).filter(Boolean).slice(0, MAX_PHOTOS);
}

async function saveNames(restaurantId, names) {
  await pool.query(
    `INSERT INTO restaurant_photos_cache (restaurant_id, photo_names, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE photo_names = VALUES(photo_names), updated_at = NOW()`,
    [restaurantId, JSON.stringify(names)]
  );
}

function parseNames(value) {
  const list = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : [];
}

async function getRestaurant(restaurantId) {
  const [rows] = await pool.query('SELECT id, google_place_id, image_url FROM restaurants WHERE id = ?', [restaurantId]);
  return rows[0] || null;
}

// Nombres de fotos del restaurante: de la caché (si tiene menos de 30 días)
// o de Places. Con refresh = true siempre consulta Places. Si Places falla,
// devuelve los que haya en caché (aunque sean viejos).
async function getPhotoNames(restaurant, { refresh = false } = {}) {
  const [cacheRows] = await pool.query(
    'SELECT photo_names, updated_at FROM restaurant_photos_cache WHERE restaurant_id = ?',
    [restaurant.id]
  );
  const cached = cacheRows[0] ? parseNames(cacheRows[0].photo_names) : null;
  const ageDays = cacheRows[0] ? (Date.now() - new Date(cacheRows[0].updated_at).getTime()) / 86400000 : Infinity;

  if (!refresh && cached && ageDays < NAMES_CACHE_DAYS) return cached;
  if (!restaurant.google_place_id || !apiKey()) return cached || [];
  // Places falló hace poco para este restaurante: no se vuelve a consultar.
  const failed = nameFailures.get(restaurant.id);
  if (failed && Date.now() - failed.at < FAILURE_TTL_MS) return cached || [];

  try {
    const names = await fetchPlacePhotoNames(restaurant.google_place_id);
    await saveNames(restaurant.id, names);
    nameFailures.delete(restaurant.id);
    return names;
  } catch (err) {
    nameFailures.set(restaurant.id, { at: Date.now(), reason: err.message });
    console.error(`[photos] No se pudieron obtener las fotos de Places del restaurante ${restaurant.id}: ${err.message}`);
    return cached || [];
  }
}

async function downloadToDisk(photoName, restaurantId, index) {
  const res = await googleFetch(`${PLACES_BASE}/${photoName}/media?maxWidthPx=${MAX_WIDTH_PX}`);
  if (!res.ok) throw await googleError(res);

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new PhotoError(`Tipo de contenido inesperado: ${contentType || 'desconocido'}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  ensureStorageDir();
  const file = path.join(STORAGE_DIR, `${restaurantId}-${index}.${ext}`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmp, buffer);
  await fs.promises.rename(tmp, file);
  return { file, contentType };
}

// Descarga la foto `index` del restaurante; si el nombre venció, renueva los
// nombres UNA vez y reintenta.
async function download(restaurant, index) {
  let names = await getPhotoNames(restaurant);
  let refreshed = false;

  for (;;) {
    const name = names[index];
    if (!name) {
      if (!refreshed && names.length === 0 && restaurant.google_place_id) {
        refreshed = true;
        names = await getPhotoNames(restaurant, { refresh: true });
        continue;
      }
      if (names.length) throw new PhotoError('Índice de foto fuera de rango');
      const placesError = nameFailures.get(restaurant.id)?.reason;
      throw new PhotoError(placesError ? `Places no devolvió fotos (${placesError})` : 'El restaurante no tiene fotos');
    }
    try {
      return await downloadToDisk(name, restaurant.id, index);
    } catch (err) {
      if (err.expired && !refreshed && restaurant.google_place_id) {
        refreshed = true;
        names = await getPhotoNames(restaurant, { refresh: true });
        continue;
      }
      throw err;
    }
  }
}

// Devuelve { file, contentType, cache: 'hit' | 'miss' } o { redirect } o
// { notFound, reason }. Nunca lanza por fallos de Google.
async function getPhoto(restaurantId, index) {
  const cached = await findOnDisk(restaurantId, index);
  if (cached) return { ...cached, cache: 'hit' };

  const key = `${restaurantId}-${index}`;
  const failure = failures.get(key);
  if (failure && Date.now() - failure.at < FAILURE_TTL_MS) return { notFound: true, reason: failure.reason };

  if (!inFlight.has(key)) {
    const job = (async () => {
      const restaurant = await getRestaurant(restaurantId);
      if (!restaurant) return { notFound: true, reason: 'Restaurante no encontrado' };
      if (!apiKey()) return { notFound: true, reason: 'GOOGLE_PLACES_API_KEY no está configurada' };
      try {
        const saved = await download(restaurant, index);
        failures.delete(key);
        return { ...saved, cache: 'miss' };
      } catch (err) {
        failures.set(key, { at: Date.now(), reason: err.message });
        console.error(`[photos] Restaurante ${restaurantId}, foto ${index}: ${err.message}`);
        return { notFound: true, reason: err.message };
      }
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  return inFlight.get(key);
}

// Foto principal: si el admin puso una URL manual (externa, no de Google) se
// redirige a ella; si no, es la primera foto de la galería.
async function getMainImage(restaurantId) {
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant) return { notFound: true, reason: 'Restaurante no encontrado' };
  if (restaurant.image_url && !isGooglePhotoUrl(restaurant.image_url)) {
    return { redirect: restaurant.image_url };
  }
  return getPhoto(restaurantId, 0);
}

// Rutas propias de la galería (nunca URLs de Google).
async function getGalleryPaths(restaurantId) {
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant) return null;
  const names = await getPhotoNames(restaurant);
  return names.map((_, i) => `/api/restaurants/${restaurantId}/photos/${i}`);
}

try {
  ensureStorageDir();
} catch (err) {
  console.error(`[photos] No se pudo crear ${STORAGE_DIR}: ${err.message}`);
}

module.exports = {
  STORAGE_DIR,
  MAX_PHOTOS,
  ensureStorageDir,
  findOnDisk,
  getPhoto,
  getMainImage,
  getGalleryPaths,
  isGooglePhotoUrl
};
