/**
 * collectRestaurantData.js
 * -----------------------------------------------------------------------------
 * Script de recolección de datos del proyecto GSI (Gastroapp).
 *
 * Implementa la "ficha de recolección de datos" del anteproyecto (Capítulo III,
 * Instrumentos y técnicas de recolección):
 *
 *   - Nombre del restaurante
 *   - Dirección (barrio/zona: Centro Histórico, Barzal, La Rosita, Villacentro)
 *   - Tipo(s) de cocina
 *   - Rango de precios (Económico / Medio / Gourmet, o numérico estimado)
 *   - Horarios de atención
 *   - Servicios disponibles (parqueadero, wifi, zona de niños)
 *   - Calificación numérica (promedio de Google Maps)
 *   - Número de reseñas encontradas
 *   - Enlace a su presencia web principal
 *
 * Población objetivo (anteproyecto, respetada tal cual):
 *   Establecimientos de comida gourmet (restaurantes, cafés y afines) ubicados
 *   en los sectores Centro Histórico, Barzal, La Rosita y Villacentro de
 *   Villavicencio, con presencia online verificable.
 *
 * FUENTES:
 *   1. Google Places API (Text Search + Place Details) -> fuente principal.
 *   2. Scraping de la página propia del restaurante (cheerio; puppeteer como
 *      fallback si el sitio carga por JS) -> complementa menú, wifi, zona de
 *      niños y rango de precios. Respeta robots.txt.
 *
 * NO se hace scraping de Google Maps ni de TripAdvisor: esos datos entran solo
 * por la API oficial de Google Places.
 *
 * NO se inventan datos: si una fuente no trae un campo, se guarda NULL.
 *
 * -----------------------------------------------------------------------------
 * Uso:
 *   npm run collect-data:places   # FASE 1: solo Google Places, sin tocar la BD
 *                                 #   (imprime cuántos restaurantes hay por zona
 *                                 #    para validar antes de seguir)
 *   npm run collect-data          # FASE 1 + FASE 2 + guardado (UPSERT) en la BD
 *
 * Flags:
 *   --dry-run            Solo Google Places. No escribe en la BD ni scrapea.
 *   --no-scraping        Google Places + guardado en BD, sin scraping.
 *   --limit=N            Máximo de fichas (Place Details) a consultar por zona.
 *   --zone="Barzal"      Procesa solo esa zona (repetible).
 *   --top=N              Cuántos de los "mejores" (rating + nº de reseñas,
 *                        promedio bayesiano) se scrapean/guardan. Por defecto
 *                        25. --top=0 desactiva el límite (todos los que
 *                        cumplan inclusión y tengan rating).
 *
 * Estrellas mostradas en la app (rating_avg): no son solo el rating de Google
 * congelado en la recolección. src/utils/ratingAvg.js las recalcula mezclando
 * google_rating/google_reviews_total con las reseñas reales de la tabla
 * reviews cada vez que este script corre o un usuario deja una reseña.
 *
 * Requiere en backend/.env:
 *   GOOGLE_PLACES_API_KEY=<tu-clave>
 * -----------------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const pool = require('../src/config/db');
const { haversineDistanceKm } = require('../src/utils/haversine');
const { recalculateRatingAvg } = require('../src/utils/ratingAvg');

// -----------------------------------------------------------------------------
// Configuración
// -----------------------------------------------------------------------------

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
// Clave separada (restringida por HTTP referrer) para las URLs de fotos que
// ve el navegador -> nunca exponer GOOGLE_PLACES_API_KEY (la del servidor,
// sin restricción de referrer) en algo que llega al frontend. Si no está
// configurada, cae de vuelta a la del servidor (funciona, pero sin esa
// protección). Ver backend/README.md, "Restringir la API key de fotos".
const GOOGLE_PLACES_PHOTO_KEY = process.env.GOOGLE_PLACES_PHOTO_KEY || GOOGLE_PLACES_API_KEY;

const CITY = 'Villavicencio';
const REGION = 'co';
const LANGUAGE = 'es';

// User-Agent identificable para el scraping de páginas propias (buena práctica
// ética + exigido para poder citar la metodología en el documento).
const USER_AGENT =
  'GastroappGSI-Investigacion/1.0 (+proyecto académico UCC; contacto: frederickabrilmogollon@gmail.com)';

const SCRAPE_DELAY_MS = 2500; // 2-3 s entre requests de scraping
const SEARCH_DELAY_MS = 220; // pausa corta entre consultas a la API
const HTTP_TIMEOUT_MS = 20000;
const MAX_RETRIES = 4;

// Media-arista del rectángulo (en grados) con el que se restringe cada Text
// Search al área de la zona. ~0.013° ≈ 1.45 km a la latitud de Villavicencio.
const ZONE_RECT_HALF_DEG = 0.013;
// Radio (km) alrededor del centroide de una zona dentro del cual se considera
// que un establecimiento "pertenece claramente" a ella al clasificar por
// coordenadas. Más lejos que esto de las 4 zonas -> "Sin clasificar".
const ZONE_CLASSIFY_RADIUS_KM = 1.6;

// Las 4 zonas del anteproyecto.
//  - queries:      consultas de Text Search, tal como las plantea el anteproyecto.
//  - geocodeQuery: se resuelve una vez al inicio contra la propia API de Google
//                  para obtener el centroide real de la zona (sin coordenadas
//                  "a ojo" en el código).
//  - matchers:     términos que, si aparecen en la dirección devuelta, asignan
//                  la zona con alta confianza sin depender de coordenadas.
//  - center:       lo rellena geocodeZones() en tiempo de ejecución.
const ZONES = [
  {
    key: 'Centro Histórico',
    queries: [`restaurante gourmet centro ${CITY}`, `café centro histórico ${CITY}`],
    geocodeQuery: `Parque de los Fundadores, Centro, ${CITY}, Meta`,
    matchers: ['centro historico', 'centro,', 'el centro', 'la esperanza', 'catedral', 'parque santander'],
    center: null,
  },
  {
    key: 'Barzal',
    queries: [`restaurante gourmet Barzal ${CITY}`, `café Barzal ${CITY}`],
    geocodeQuery: `Barrio Barzal, ${CITY}, Meta`,
    matchers: ['barzal'],
    center: null,
  },
  {
    key: 'La Rosita',
    queries: [`restaurante gourmet La Rosita ${CITY}`, `café La Rosita ${CITY}`],
    geocodeQuery: `Barrio La Rosita, ${CITY}, Meta`,
    matchers: ['la rosita', 'rosita'],
    center: null,
  },
  {
    key: 'Villacentro',
    queries: [`restaurante gourmet Villacentro ${CITY}`, `café Villacentro ${CITY}`],
    geocodeQuery: `Centro Comercial Villacentro, ${CITY}, Meta`,
    matchers: ['villacentro', 'villa centro'],
    center: null,
  },
];

const UNCLASSIFIED = 'Sin clasificar';

// Centroides de referencia de cada zona, verificados contra puntos conocidos de
// Villavicencio con la propia API de Google (agosto 2026):
//   - Centro Histórico -> Parque Santander / Catedral Nuestra Señora del Carmen.
//   - Barzal           -> Barzal Alto/Bajo (occidente del centro).
//   - Villacentro      -> Centro Comercial Villacentro, Av. 40 #16B-159.
//   - La Rosita        -> barrio La Rosita al sur (cercano a la UCC, Cra 22 Sur).
// Si aquí hay coordenadas para una zona, se usan tal cual; si no, geocodeZones()
// las resuelve al vuelo con Text Search del nombre del barrio.
// >>> Si algún sector debe centrarse en otro punto, ajústalo aquí. <<<
const ZONE_CENTERS = {
  'Centro Histórico': { lat: 4.1519, lng: -73.6385 },
  Barzal: { lat: 4.14622, lng: -73.63869 },
  'La Rosita': { lat: 4.11468, lng: -73.61112 },
  Villacentro: { lat: 4.13348, lng: -73.63779 },
};

// "Límítalo a los mejores": por defecto solo se scrapean/guardan los N con
// mejor promedio bayesiano (rating + nº de reseñas), no todos los que cumplen
// inclusión. --top=0 desactiva el corte.
const DEFAULT_TOP_N = 25;

const OUTPUT_DIR = path.join(__dirname, 'output');
const REPORT_PATH = path.join(OUTPUT_DIR, 'reporte-recoleccion.json');

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' };
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[áéíóúñü]/g, (c) => ACCENTS[c])
    .replace(/\s+/g, ' ')
    .trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = { dryRun: false, scraping: true, limit: Infinity, zones: [], top: DEFAULT_TOP_N };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-scraping') args.scraping = false;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10) || Infinity;
    else if (a.startsWith('--zone=')) args.zones.push(a.split('=')[1].replace(/^["']|["']$/g, ''));
    else if (a.startsWith('--top=')) {
      const n = parseInt(a.split('=')[1], 10);
      args.top = Number.isFinite(n) && n > 0 ? n : Infinity;
    }
  }
  if (args.dryRun) args.scraping = false;
  return args;
}

// fetch con reintentos + backoff exponencial. Cubre 429/5xx (rate limiting /
// errores transitorios) tanto de Google como de los sitios que se scrapean.
async function fetchWithRetry(url, { as = 'json', method = 'GET', headers = {}, body = null } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const wait = Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.random() * 400;
      await sleep(wait);
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': USER_AGENT, ...headers },
        body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(t);

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} en ${url}`);
        continue;
      }
      if (as === 'text') {
        return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : '' };
      }
      const parsed = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body: parsed };
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
    }
  }
  throw lastErr || new Error(`No se pudo completar la petición a ${url}`);
}

// -----------------------------------------------------------------------------
// FUENTE 1 — Google Places API
// -----------------------------------------------------------------------------

// Se usa Places API (New): un solo POST a places:searchText devuelve todos los
// campos de la ficha (no hace falta un "Place Details" aparte). La Places API
// "legacy" ya no se puede habilitar en proyectos nuevos de Google Cloud.
const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const PHOTO_MEDIA_BASE = 'https://places.googleapis.com/v1';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.photos',
  'nextPageToken',
].join(',');

// price_level de Google -> nivel numérico 0-4 (enum de la API New).
const PRICE_ENUM = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function textSearchAll(query, locationRestriction = null) {
  const results = [];
  let pageToken = null;
  let page = 0;

  do {
    const reqBody = {
      textQuery: query,
      languageCode: LANGUAGE,
      regionCode: REGION.toUpperCase(),
      pageSize: 20,
    };
    if (locationRestriction) reqBody.locationRestriction = locationRestriction;
    if (pageToken) {
      reqBody.pageToken = pageToken;
      await sleep(1500); // el pageToken tarda un momento en activarse
    }

    const { ok, status, body } = await fetchWithRetry(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: reqBody,
    });

    if (!ok) {
      const msg = body && body.error ? `${body.error.status || status}: ${body.error.message}` : `HTTP ${status}`;
      if (body && body.error && body.error.status === 'PERMISSION_DENIED') {
        throw new Error(
          `Google Places rechazó la petición (${msg}).\n` +
            `  Habilita "Places API (New)" en https://console.cloud.google.com/ y revisa\n` +
            `  que la clave GOOGLE_PLACES_API_KEY no tenga restricciones de API que la excluyan.`
        );
      }
      throw new Error(`Google Places searchText -> ${msg}`);
    }

    for (const p of body.places || []) results.push(p);
    pageToken = body.nextPageToken || null;
    page += 1;
  } while (pageToken && page < 3);

  return results;
}

function photoUrl(photoName, maxWidthPx = 800) {
  if (!photoName) return null;
  const params = new URLSearchParams({ maxWidthPx: String(maxWidthPx), key: GOOGLE_PLACES_PHOTO_KEY });
  return `${PHOTO_MEDIA_BASE}/${photoName}/media?${params.toString()}`;
}

// Fija el centroide de cada zona: usa ZONE_CENTERS si está definido; si no, lo
// resuelve contra la propia API de Google (Text Search del nombre del barrio).
async function geocodeZones() {
  for (const z of ZONES) {
    if (ZONE_CENTERS[z.key]) {
      z.center = { ...ZONE_CENTERS[z.key] };
      console.log(`  · ${z.key.padEnd(18)} centroide ${z.center.lat.toFixed(5)}, ${z.center.lng.toFixed(5)}  (fijado y verificado)`);
      continue;
    }
    try {
      const hits = await textSearchAll(z.geocodeQuery);
      const loc = hits[0] && hits[0].location;
      if (loc && loc.latitude != null) {
        z.center = { lat: loc.latitude, lng: loc.longitude };
        console.log(`  · ${z.key.padEnd(18)} centroide ${z.center.lat.toFixed(5)}, ${z.center.lng.toFixed(5)}  (geocodificado)`);
      } else {
        console.log(`  · ${z.key.padEnd(18)} sin centroide (Google no resolvió "${z.geocodeQuery}")`);
      }
    } catch (err) {
      console.log(`  · ${z.key.padEnd(18)} error geocodificando: ${err.message}`);
    }
    await sleep(SEARCH_DELAY_MS);
  }
}

function zoneRectangle(center) {
  if (!center) return null;
  return {
    rectangle: {
      low: { latitude: center.lat - ZONE_RECT_HALF_DEG, longitude: center.lng - ZONE_RECT_HALF_DEG },
      high: { latitude: center.lat + ZONE_RECT_HALF_DEG, longitude: center.lng + ZONE_RECT_HALF_DEG },
    },
  };
}

// Clasificación de zona, en dos pasos y sin forzar:
//   1) si la dirección menciona explícitamente un barrio objetivo -> esa zona.
//   2) si no, y hay coordenadas, se asigna a la zona cuyo centroide esté más
//      cerca, siempre que quede dentro de ZONE_CLASSIFY_RADIUS_KM.
//   3) en cualquier otro caso -> "Sin clasificar".
function detectZone(formattedAddress, lat, lng) {
  const addr = norm(formattedAddress);
  for (const z of ZONES) {
    if (z.matchers.some((m) => addr.includes(norm(m)))) return { zone: z.key, method: 'direccion' };
  }
  if (lat != null && lng != null) {
    let best = null;
    for (const z of ZONES) {
      if (!z.center) continue;
      const d = haversineDistanceKm(lat, lng, z.center.lat, z.center.lng);
      if (!best || d < best.d) best = { zone: z.key, d };
    }
    if (best && best.d <= ZONE_CLASSIFY_RADIUS_KM) {
      return { zone: best.zone, method: `coordenadas (${best.d.toFixed(2)} km del centroide)` };
    }
  }
  return { zone: UNCLASSIFIED, method: 'sin coincidencia con las 4 zonas' };
}

// Google no entrega "tipo de cocina" como tal. Se infiere del nombre y de los
// `types`; si no hay señal, se deja NULL (no se inventa).
const CUISINE_HINTS = [
  [/parrill|asad|carne|steak|grill/, 'Parrilla'],
  [/pizz/, 'Pizzería'],
  [/sushi|japon|nikkei|ramen/, 'Japonesa'],
  [/burg|hamburgues/, 'Hamburguesas'],
  [/taco|mexican|burrito/, 'Mexicana'],
  [/italian|pasta|trattoria|risotto/, 'Italiana'],
  [/marisc|pescad|cevich|seafood/, 'Mariscos'],
  [/caf[eé]|cafeter|brunch|reposter|panader|past(e|é)ler/, 'Café / Repostería'],
  [/vegan|vegetarian|plant based/, 'Vegetariana / Vegana'],
  [/llanero|llanera|mamona|crioll|colombian|típic|tipic/, 'Llanera / Colombiana'],
  [/arab|shawarma|libanes/, 'Árabe'],
  [/china|chifa|wok/, 'China'],
  [/gourmet|bistro|bistró|fusion|fusión|autor/, 'Gourmet / De autor'],
];

function inferCuisine(name, types, primaryTypeLabel) {
  const hay = norm(`${name} ${(types || []).join(' ')} ${primaryTypeLabel || ''}`);
  for (const [re, label] of CUISINE_HINTS) if (re.test(hay)) return label;
  // Etiqueta de Google como último recurso (ej. "Restaurante mediterráneo").
  if (primaryTypeLabel && !/^restaurante?$/i.test(primaryTypeLabel.trim())) return primaryTypeLabel.trim();
  return null;
}

// price_level (0-4) de Google -> categoría del anteproyecto.
function priceLevelToCategoria(level) {
  if (level == null) return null;
  if (level <= 1) return 'Económico';
  if (level === 2) return 'Medio';
  return 'Gourmet'; // 3 y 4
}

// price_level (0-4) de Google -> símbolo que usa el esquema actual ($..$$$$).
function priceLevelToSymbol(level) {
  if (level == null) return null;
  return ['$', '$', '$$', '$$$', '$$$$'][level] || null;
}

// Criterio de inclusión del anteproyecto: "presencia online verificable
// (página web propia, redes sociales, o listados en plataformas de reseñas)".
// Se operacionaliza como: tiene sitio web / red social propia, O tiene al menos
// una reseña en Google (evidencia de listado activo, no solo un pin en el mapa).
// Estar en Google Maps sin web y sin ninguna reseña NO cuenta como presencia
// verificable -> queda excluido y se reporta.
function meetsInclusion(r) {
  const hasWeb = !!r.website;
  const hasReviews = (r.google_reviews_total || 0) > 0;
  const ok = hasWeb || hasReviews;
  const reasons = [];
  if (hasWeb) reasons.push('web/red social propia');
  if (hasReviews) reasons.push(`${r.google_reviews_total} reseñas en Google`);
  return { ok, reason: reasons.join('; ') || 'sin web y sin reseñas en Google' };
}

// Convierte una ficha de Places API (New) en el registro normalizado del proyecto.
function toRecord(d) {
  const loc = d.location || {};
  const name = ((d.displayName && d.displayName.text) || '').trim();
  const address = (d.formattedAddress || '').trim();
  const primaryTypeLabel = d.primaryTypeDisplayName && d.primaryTypeDisplayName.text;
  const level = d.priceLevel != null && PRICE_ENUM[d.priceLevel] != null ? PRICE_ENUM[d.priceLevel] : null;
  const hours =
    d.regularOpeningHours && Array.isArray(d.regularOpeningHours.weekdayDescriptions)
      ? d.regularOpeningHours.weekdayDescriptions
      : [];
  const photoName = d.photos && d.photos.length ? d.photos[0].name : null;

  const zoning = detectZone(address, loc.latitude, loc.longitude);

  const rec = {
    google_place_id: d.id,
    name,
    address,
    neighborhood: zoning.zone,
    zone_method: zoning.method,
    cuisine_type: inferCuisine(name, d.types, primaryTypeLabel),
    price_level: level,
    price_categoria: priceLevelToCategoria(level),
    price_range: priceLevelToSymbol(level), // null si Google no lo trae
    opening_hours: hours.length ? hours.join(' | ') : null,
    phone: d.nationalPhoneNumber || d.internationalPhoneNumber || null,
    website: d.websiteUri || null,
    google_maps_url: d.googleMapsUri || null,
    google_rating: d.rating != null ? d.rating : null,
    google_reviews_total: d.userRatingCount != null ? d.userRatingCount : null,
    types: d.types || [],
    lat: loc.latitude != null ? loc.latitude : null,
    lng: loc.longitude != null ? loc.longitude : null,
    image_url: photoName ? photoUrl(photoName) : null,
    business_status: d.businessStatus || null,
    // servicios: solo se marca lo que se confirma; ausencia != false
    has_wifi: null,
    kids_zone: null,
    parking_type: null,
    data_source: 'google_places',
    scraped: false,
    scrape_error: null,
    menu_items: [],
  };

  const inclusion = meetsInclusion(rec);
  rec.meets_inclusion = inclusion.ok;
  rec.inclusion_reason = inclusion.reason;
  return rec;
}

// Recorre las 4 zonas, hace Text Search (New) restringido al rectángulo de cada
// zona y devuelve los registros normalizados, deduplicados por place_id. Cada
// respuesta ya trae la ficha completa: no hay "Place Details" aparte.
// La zona final de cada registro la decide detectZone() (dirección o centroide
// más cercano), no la consulta con la que se encontró.
async function collectFromPlaces(args) {
  const byPlaceId = new Map();
  const perQueryRaw = {}; // "zona · query" -> nº de resultados crudos

  const zonesToRun = args.zones.length
    ? ZONES.filter((z) => args.zones.some((n) => norm(n) === norm(z.key)))
    : ZONES;

  console.log('  Resolviendo centroides de las zonas con la API de Google...');
  await geocodeZones();
  console.log('');

  for (const zone of zonesToRun) {
    const rect = zoneRectangle(zone.center); // null si no se pudo geocodificar
    const seenInZone = new Set();

    for (const query of zone.queries) {
      process.stdout.write(`  · Text Search${rect ? ' [área de la zona]' : ''}: "${query}" ... `);
      let hits;
      try {
        hits = await textSearchAll(query, rect);
      } catch (err) {
        console.log(`ERROR`);
        throw err; // un fallo aquí normalmente es la API key: abortar
      }
      console.log(`${hits.length} resultados`);
      perQueryRaw[`${zone.key} · ${query}`] = hits.length;

      for (const h of hits) {
        if (!h.id) continue;
        if (seenInZone.size >= args.limit && !seenInZone.has(h.id)) break;
        seenInZone.add(h.id);
        if (byPlaceId.has(h.id)) continue; // ya visto en otra consulta/zona

        try {
          byPlaceId.set(h.id, toRecord(h));
        } catch (err) {
          const nm = (h.displayName && h.displayName.text) || h.id;
          console.log(`    ! No se pudo normalizar "${nm}": ${err.message}`);
        }
      }
      await sleep(SEARCH_DELAY_MS);
    }
  }

  const centroids = {};
  for (const z of ZONES) centroids[z.key] = z.center;
  return { records: [...byPlaceId.values()], perQueryRaw, centroids };
}

// -----------------------------------------------------------------------------
// FUENTE 2 — Scraping complementario (solo páginas propias del restaurante)
// -----------------------------------------------------------------------------

let cheerio = null;
let robotsParser = null;
let puppeteer = null;

function loadScrapingDeps() {
  if (!cheerio) cheerio = require('cheerio');
  if (!robotsParser) robotsParser = require('robots-parser');
}

// Redes sociales, agregadores, apps de menú/reserva y directorios de reseñas.
// Cuentan como "presencia web verificable" pero NO se scrapean: no son la
// página propia del restaurante y varios prohíben el scraping en sus términos
// (Instagram/Facebook/TripAdvisor). El scraping se limita a dominios propios.
const NON_OWN_WEBSITE_HOSTS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'm.facebook.com',
  'wa.me',
  'api.whatsapp.com',
  'whatsapp.com',
  't.me',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'linktr.ee',
  'linktree.com',
  'lnk.bio',
  'linkr.bio',
  'bio.link',
  'beacons.ai',
  'bitl.la',
  'tripadvisor.com',
  'tripadvisor.co',
  'tripadvisor.com.co',
  'rappi.com',
  'rappi.app.link',
  'menupp.co',
  'app.menupp.co',
  'ola.click',
  'getmudy.com',
  'getmudy.co',
  'apparta.co',
  'tourlat.com',
  'tullano.com',
  'canva.site',
  'my.canva.site',
  'google.com',
  'sites.google.com',
  'goo.gl',
  'linktr.ee',
];

function ownWebsiteOrNull(url) {
  if (!url) return null;
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_) {
    return null;
  }
  if (NON_OWN_WEBSITE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return url;
}

const WIFI_KEYWORDS = ['wifi', 'wi-fi', 'wi fi', 'internet gratis', 'internet gratuito', 'zona wifi'];
const KIDS_KEYWORDS = [
  'zona de niños',
  'zona infantil',
  'área infantil',
  'area infantil',
  'juegos para niños',
  'zona de juegos',
  'kids zone',
  'kids corner',
  'espacio para niños',
  'menú infantil',
  'menu infantil',
];
const PARKING_KEYWORDS = ['parqueadero', 'parqueo', 'estacionamiento', 'valet', 'zona de parqueo'];

// Precio en pesos colombianos: 12.000  /  $ 25.000  /  8,500  /  $18000
const PRICE_RE = /\$?\s?(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})(?:\s?(?:cop|pesos|m|mil|k))?/gi;

function parseCopPrice(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d.,\s]/g, '').trim();
  // "12.000" / "12 000" -> 12000 ; "1.250.000" -> 1250000
  digits = digits.replace(/[.,\s]/g, '');
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1000 || n > 2000000) return null; // fuera de rango plausible para un plato
  return n;
}

async function checkRobots(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const robotsUrl = `${u.origin}/robots.txt`;
    const { ok, text } = await fetchWithRetry(robotsUrl, { as: 'text' });
    if (!ok || !text) return { allowed: true, note: 'sin robots.txt (se asume permitido)' };
    const robots = robotsParser(robotsUrl, text);
    const allowed = robots.isAllowed(targetUrl, USER_AGENT) !== false;
    return { allowed, note: allowed ? 'permitido por robots.txt' : 'bloqueado por robots.txt' };
  } catch (err) {
    return { allowed: true, note: `no se pudo leer robots.txt (${err.message}); se asume permitido` };
  }
}

function looksJsRendered(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const hasAppRoot = /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html);
  return text.length < 600 && (hasAppRoot || /window\.__(NEXT|NUXT)_DATA__/.test(html));
}

async function fetchRenderedHtml(url) {
  if (!puppeteer) {
    try {
      puppeteer = require('puppeteer');
    } catch (_) {
      return null; // puppeteer no instalado: se continúa solo con el HTML estático
    }
  }
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: HTTP_TIMEOUT_MS });
    return await page.content();
  } catch (err) {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function extractServices(text) {
  const t = norm(text);
  return {
    has_wifi: WIFI_KEYWORDS.some((k) => t.includes(norm(k))) ? true : null,
    kids_zone: KIDS_KEYWORDS.some((k) => t.includes(norm(k))) ? true : null,
    parking_mention: PARKING_KEYWORDS.some((k) => t.includes(norm(k))),
  };
}

function extractPriceRange(text) {
  const t = norm(text);
  if (/(econ[oó]mic|bajo costo|precios bajos|desde \$?\s?\d)/.test(t) && !/gourmet/.test(t)) return 'Económico';
  if (/(gourmet|alta cocina|fine dining|men[uú] degustaci[oó]n)/.test(t)) return 'Gourmet';
  if (/(precio medio|precios moderados)/.test(t)) return 'Medio';
  return null;
}

// Heurística de menú: elementos cuyo texto contiene un precio en pesos; el
// nombre del plato es el texto que lo precede. Resultado best-effort marcado
// para revisión manual.
function extractMenuItems($) {
  const items = [];
  const seen = new Set();
  const selector =
    'li, tr, p, article, .menu-item, .product, [class*="menu"], [class*="plato"], [class*="producto"], [class*="dish"], [class*="item"]';

  $(selector).each((_, el) => {
    if (items.length >= 60) return false;
    const $el = $(el);
    if ($el.children(selector).length > 0) return; // preferir el nodo hoja
    const raw = $el.text().replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 220) return;

    const priceMatch = raw.match(PRICE_RE);
    if (!priceMatch) return;
    const price = parseCopPrice(priceMatch[priceMatch.length - 1]);
    if (!price) return;

    let name = raw.replace(PRICE_RE, '').replace(/[-–—:·|]+\s*$/, '').replace(/\s+/g, ' ').trim();
    if (name.length < 3 || name.length > 90 || !/[a-záéíóúñ]/i.test(name)) return;

    const key = norm(name);
    if (seen.has(key)) return;
    seen.add(key);

    // Categoría: encabezado más cercano hacia arriba.
    let category = null;
    const heading = $el.prevAll('h1,h2,h3,h4,h5,strong,b').first().text().replace(/\s+/g, ' ').trim();
    if (heading && heading.length <= 40) category = heading;

    items.push({
      name: name.slice(0, 160),
      description: null,
      price,
      category: category || 'Sin categoría',
      source: 'scraping',
    });
  });

  return items;
}

// Scrapea la página propia de un restaurante. Nunca lanza: en caso de fallo
// devuelve { ok:false, error } y el pipeline sigue con el resto.
async function scrapeOwnSite(record) {
  loadScrapingDeps();
  const url = record.website;
  const result = {
    ok: false,
    error: null,
    robots_note: null,
    has_wifi: null,
    kids_zone: null,
    price_range_text: null,
    menu_items: [],
    rendered_with: 'cheerio',
  };

  try {
    // 1. robots.txt
    const robots = await checkRobots(url);
    result.robots_note = robots.note;
    if (!robots.allowed) {
      result.error = 'bloqueado por robots.txt';
      return result;
    }

    // 2. HTML estático
    const staticRes = await fetchWithRetry(url, { as: 'text' });
    if (!staticRes.ok || !staticRes.text) {
      result.error = `no se pudo descargar el sitio (HTTP ${staticRes.status})`;
      return result;
    }
    let html = staticRes.text;

    // 3. ¿Contenido cargado por JS? -> puppeteer como fallback
    if (looksJsRendered(html)) {
      const rendered = await fetchRenderedHtml(url);
      if (rendered) {
        html = rendered;
        result.rendered_with = 'puppeteer';
      } else {
        result.rendered_with = 'cheerio (puppeteer no disponible)';
      }
    }

    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    const pageText = $('body').text().replace(/\s+/g, ' ').trim();

    const services = extractServices(pageText);
    result.has_wifi = services.has_wifi;
    result.kids_zone = services.kids_zone;
    result.price_range_text = extractPriceRange(pageText);
    result.menu_items = extractMenuItems($);

    result.ok = true;
    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

// -----------------------------------------------------------------------------
// Centros comerciales: parqueadero compartido
// -----------------------------------------------------------------------------

// Un restaurante dentro de un centro comercial no tiene parqueadero propio:
// usa el del CC, compartido con todos los locales de adentro. Google Places
// no expone un "lugar padre" en Text Search (New), así que se detecta por
// texto: la palabra "centro comercial" en el nombre o la dirección. En la
// práctica Google la reporta de dos formas distintas:
//   "Centro comercial Primavera Urbana, Cl. 15 #40-01 Local 158..."
//   "Cl. 15 #40-01 Centro Comercial, Primavera Urbana, Local 225-226..."
// (el nombre del CC queda pegado a la frase, o en el segmento siguiente).
const MALL_RE = /centro\s*comercial\s*(.*)/i;

function looksLikeStreetOrLocal(segment) {
  return /^(cl\.|cra\.|av\.|calle|carrera|avenida|diagonal|transversal|local|piso|torre|edificio|villavicencio|meta|\d)/i.test(
    segment.trim()
  );
}

// Devuelve el nombre del centro comercial (ej. "Primavera Urbana") o null.
function detectMall(record) {
  const segments = `${record.name}, ${record.address}`.split(',').map((s) => s.trim());
  for (let i = 0; i < segments.length; i++) {
    const m = MALL_RE.exec(segments[i]);
    if (!m) continue;
    let name = m[1].replace(/^[,\-\s]+|[,\-\s]+$/g, '').trim();
    // La frase "centro comercial" venía pegada al número de la calle: el
    // nombre real del CC suele estar en el siguiente segmento de la dirección.
    if (!name && segments[i + 1] && !looksLikeStreetOrLocal(segments[i + 1])) {
      name = segments[i + 1];
    }
    if (name && !looksLikeStreetOrLocal(name)) return name;
  }
  return null;
}

// Busca una referencia de coordenadas para el parqueadero del CC: primero
// intenta el parqueadero propio del centro comercial (si Google lo tiene
// como ficha aparte); si no aparece, usa las coordenadas del centro
// comercial mismo (aceptado explícitamente como referencia válida).
async function findMallReference(mallName) {
  try {
    const parkingHits = await textSearchAll(`parqueadero ${mallName} ${CITY}`);
    if (parkingHits.length && parkingHits[0].location) {
      return {
        lat: parkingHits[0].location.latitude,
        lng: parkingHits[0].location.longitude,
        via: 'parqueadero propio del CC (Google Places)',
      };
    }
  } catch (_) {
    /* sigue con el siguiente intento */
  }

  try {
    const mallHits = await textSearchAll(`${mallName} ${CITY}`);
    if (mallHits.length && mallHits[0].location) {
      return {
        lat: mallHits[0].location.latitude,
        lng: mallHits[0].location.longitude,
        via: 'coordenadas del centro comercial (Google Places)',
      };
    }
  } catch (_) {
    /* se resuelve con el fallback del llamador */
  }

  return null;
}

// -----------------------------------------------------------------------------
// Migración de esquema (idempotente)
// -----------------------------------------------------------------------------

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(table, index) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [table, index]
  );
  return rows.length > 0;
}

async function columnType(table, column) {
  const [rows] = await pool.query(
    `SELECT column_type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length ? rows[0].column_type || rows[0].COLUMN_TYPE : null;
}

async function ensureSchema() {
  const steps = [];

  if (!(await columnExists('restaurants', 'data_source'))) {
    steps.push([
      "ALTER TABLE restaurants ADD COLUMN data_source VARCHAR(32) NOT NULL DEFAULT 'manual'",
      'restaurants.data_source',
    ]);
  }
  if (!(await columnExists('restaurants', 'google_place_id'))) {
    steps.push([
      'ALTER TABLE restaurants ADD COLUMN google_place_id VARCHAR(128) NULL',
      'restaurants.google_place_id',
    ]);
  }
  if (!(await columnExists('restaurants', 'google_rating'))) {
    steps.push(['ALTER TABLE restaurants ADD COLUMN google_rating DECIMAL(2,1) NULL', 'restaurants.google_rating']);
  }
  if (!(await columnExists('restaurants', 'google_reviews_total'))) {
    steps.push([
      'ALTER TABLE restaurants ADD COLUMN google_reviews_total INT NULL',
      'restaurants.google_reviews_total',
    ]);
  }
  if (!(await columnExists('restaurants', 'google_maps_url'))) {
    steps.push([
      'ALTER TABLE restaurants ADD COLUMN google_maps_url VARCHAR(255) NULL',
      'restaurants.google_maps_url',
    ]);
  }
  if (!(await columnExists('restaurants', 'collected_at'))) {
    steps.push(['ALTER TABLE restaurants ADD COLUMN collected_at TIMESTAMP NULL', 'restaurants.collected_at']);
  }
  if (!(await indexExists('restaurants', 'uq_google_place_id'))) {
    steps.push([
      'ALTER TABLE restaurants ADD UNIQUE INDEX uq_google_place_id (google_place_id)',
      'índice uq_google_place_id',
    ]);
  }
  if (!(await columnExists('menu_items', 'source'))) {
    steps.push([
      "ALTER TABLE menu_items ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'",
      'menu_items.source',
    ]);
  }

  const cuisineType = (await columnType('restaurants', 'cuisine_type')) || '';
  const hoursType = (await columnType('restaurants', 'opening_hours')) || '';
  const priceType = (await columnType('restaurants', 'price_range')) || '';
  const hoodType = (await columnType('restaurants', 'neighborhood')) || '';

  // Estas comprobaciones miran INFORMATION_SCHEMA, que no reporta NOT NULL en
  // column_type; se re-aplican siempre (son idempotentes y baratas).
  steps.push(['ALTER TABLE restaurants MODIFY COLUMN cuisine_type VARCHAR(80) NULL', 'cuisine_type NULL']);
  steps.push(['ALTER TABLE restaurants MODIFY COLUMN opening_hours VARCHAR(255) NULL', 'opening_hours NULL']);
  steps.push([
    "ALTER TABLE restaurants MODIFY COLUMN price_range ENUM('$','$$','$$$','$$$$') NULL DEFAULT NULL",
    'price_range NULL',
  ]);
  if (!norm(hoodType).includes('sin clasificar')) {
    steps.push([
      "ALTER TABLE restaurants MODIFY COLUMN neighborhood ENUM('Centro Histórico','Barzal','La Rosita','Villacentro','Sin clasificar') NOT NULL",
      "neighborhood + 'Sin clasificar'",
    ]);
  }

  // Las URLs de fotos de Google Places (New) superan los 255 caracteres
  // (incluyen el resource name completo + la API key) -> ensancharla a TEXT.
  const imageUrlType = (await columnType('restaurants', 'image_url')) || '';
  const imageUrlVarchar = /^varchar\((\d+)\)/i.exec(imageUrlType);
  if (imageUrlVarchar && parseInt(imageUrlVarchar[1], 10) < 1024) {
    steps.push(['ALTER TABLE restaurants MODIFY COLUMN image_url TEXT NULL', 'image_url -> TEXT']);
  }

  // Parqueadero compartido de centro comercial (ver detectMall() más abajo).
  const parkingTypeType = (await columnType('parkings', 'type')) || '';
  if (!parkingTypeType.includes('centro_comercial')) {
    steps.push([
      "ALTER TABLE parkings MODIFY COLUMN type ENUM('propio','convenio','publico','centro_comercial') NOT NULL",
      "parkings.type + 'centro_comercial'",
    ]);
  }

  void cuisineType;
  void hoursType;
  void priceType;

  if (!steps.length) {
    console.log('  Esquema ya actualizado, no hay migraciones pendientes.');
    return;
  }
  for (const [sql, label] of steps) {
    try {
      await pool.query(sql);
      console.log(`  ✓ ${label}`);
    } catch (err) {
      // Si otra ejecución ya lo aplicó, seguir.
      if (/Duplicate|already exists|check that column/i.test(err.message)) {
        console.log(`  = ${label} (ya aplicado)`);
      } else {
        throw err;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// FUSIÓN Y GUARDADO (UPSERT)
// -----------------------------------------------------------------------------

// Combina la ficha de Google con lo obtenido del scraping. Solo sobrescribe un
// campo si el scraping aportó un valor (no pisa datos con NULL).
function mergeRecord(record, scrape) {
  if (!scrape || !scrape.ok) {
    record.scrape_error = scrape ? scrape.error : 'no ejecutado';
    return record;
  }
  record.scraped = true;
  record.data_source = 'google_places+scraping';
  if (scrape.has_wifi === true) record.has_wifi = true;
  if (scrape.kids_zone === true) record.kids_zone = true;
  if (scrape.menu_items && scrape.menu_items.length) record.menu_items = scrape.menu_items;

  // Rango de precios: solo si Google no lo trajo y el sitio lo publica.
  if (!record.price_categoria && scrape.price_range_text) {
    record.price_categoria = scrape.price_range_text;
    record.price_range = { Económico: '$', Medio: '$$', Gourmet: '$$$' }[scrape.price_range_text] || null;
  }
  return record;
}

async function findExisting(record) {
  const [byId] = record.google_place_id
    ? await pool.query('SELECT * FROM restaurants WHERE google_place_id = ? LIMIT 1', [record.google_place_id])
    : [[]];
  if (byId.length) return byId[0];

  const [byNameAddr] = await pool.query(
    'SELECT * FROM restaurants WHERE name = ? AND address = ? LIMIT 1',
    [record.name, record.address]
  );
  return byNameAddr.length ? byNameAddr[0] : null;
}

// Solo pone valor donde el registro nuevo lo tiene; conserva lo que ya había
// (incluidas ediciones manuales) cuando la fuente automática trae NULL.
function buildUpdateSet(record, existing) {
  const fields = {};
  const setIf = (col, val) => {
    if (val !== null && val !== undefined && val !== '') fields[col] = val;
  };

  setIf('name', record.name);
  setIf('address', record.address);
  setIf('neighborhood', record.neighborhood);
  setIf('cuisine_type', record.cuisine_type);
  setIf('price_range', record.price_range);
  setIf('opening_hours', record.opening_hours);
  setIf('phone', record.phone);
  setIf('website', record.website);
  setIf('google_place_id', record.google_place_id);
  setIf('google_maps_url', record.google_maps_url);
  setIf('google_rating', record.google_rating);
  setIf('google_reviews_total', record.google_reviews_total);
  setIf('image_url', record.image_url);
  setIf('lat', record.lat);
  setIf('lng', record.lng);
  setIf('data_source', record.data_source);
  fields.collected_at = new Date();

  // rating_avg NO se toca aquí: recalculateRatingAvg() lo recalcula justo
  // después del upsert, combinando google_rating/google_reviews_total (ya
  // guardados arriba) con las reseñas reales de usuarios en la tabla reviews.
  // servicios: solo pasar de "no" a "sí" cuando se confirmó; nunca al revés.
  if (record.has_wifi === true) fields.has_wifi = 1;
  if (record.kids_zone === true) fields.kids_zone = 1;

  return fields;
}

async function upsertRestaurant(record, stats) {
  const existing = await findExisting(record);

  if (existing) {
    const fields = buildUpdateSet(record, existing);
    const cols = Object.keys(fields);
    if (cols.length) {
      await pool.query(
        `UPDATE restaurants SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...cols.map((c) => fields[c]), existing.id]
      );
    }
    stats.updated += 1;
    return existing.id;
  }

  // INSERT nuevo. address/lat/lng son NOT NULL en el esquema: si falta alguno
  // (raro en Places), no se puede insertar -> se reporta y se omite.
  if (!record.address || record.lat == null || record.lng == null) {
    stats.skipped_no_coords += 1;
    return null;
  }

  const [res] = await pool.query(
    `INSERT INTO restaurants
       (name, address, neighborhood, cuisine_type, price_range, opening_hours, phone, website,
        has_wifi, parking_type, kids_zone, rating_avg, image_url, lat, lng,
        data_source, google_place_id, google_maps_url, google_rating, google_reviews_total, collected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.name,
      record.address,
      record.neighborhood,
      record.cuisine_type,
      record.price_range,
      record.opening_hours,
      record.phone,
      record.website,
      record.has_wifi === true ? 1 : 0,
      'no_disponible', // parking_type: Places no lo confirma; se deja el default
      record.kids_zone === true ? 1 : 0,
      record.google_rating != null ? record.google_rating : 0,
      record.image_url,
      record.lat,
      record.lng,
      record.data_source,
      record.google_place_id,
      record.google_maps_url,
      record.google_rating,
      record.google_reviews_total,
      new Date(),
    ]
  );
  stats.inserted += 1;
  return res.insertId;
}

// Inserta el menú scrapeado solo si el restaurante aún no tiene ítems (evita
// duplicar en re-ejecuciones y no pisa el menú cargado a mano).
async function saveMenuItems(restaurantId, items, stats) {
  if (!restaurantId || !items.length) return;
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM menu_items WHERE restaurant_id = ?', [
    restaurantId,
  ]);
  if (n > 0) {
    stats.menu_skipped_has_items += 1;
    return;
  }
  const values = items.map((it) => [restaurantId, it.name, it.description, it.price, it.category, 'scraping']);
  await pool.query(
    'INSERT INTO menu_items (restaurant_id, name, description, price, category, source) VALUES ?',
    [values]
  );
  stats.menu_inserted += items.length;
}

// -----------------------------------------------------------------------------
// Selección de los mejores N (ranking ponderado rating + nº de reseñas)
// -----------------------------------------------------------------------------

// Promedio bayesiano (estilo IMDb): evita que un 5.0 con 2 reseñas le gane a
// un 4.6 con 500. m y C se calculan a partir de los propios candidatos de esta
// corrida (no son un número fijo en el código), así el corte se adapta a los
// datos reales de cada ejecución.
//   v = nº de reseñas del restaurante, R = su rating de Google
//   m = promedio de reseñas entre los candidatos, C = rating promedio entre ellos
//   score = (v / (v + m)) * R + (m / (v + m)) * C
function rankAndSelectTop(records, topN) {
  const candidates = records.filter((r) => r.meets_inclusion);
  const rankable = candidates.filter((r) => r.google_rating != null && r.google_reviews_total != null);
  const sinCalificar = candidates.filter((r) => !(r.google_rating != null && r.google_reviews_total != null));

  const C = rankable.length ? rankable.reduce((s, r) => s + r.google_rating, 0) / rankable.length : 0;
  const m = rankable.length ? rankable.reduce((s, r) => s + r.google_reviews_total, 0) / rankable.length : 0;

  for (const r of rankable) {
    const v = r.google_reviews_total;
    r.ranking_score = (v / (v + m)) * r.google_rating + (m / (v + m)) * C;
  }
  rankable.sort((a, b) => b.ranking_score - a.ranking_score);

  const n = Number.isFinite(topN) ? topN : rankable.length;
  const selected = rankable.slice(0, n);
  const descartados = rankable.slice(n);

  return { selected, descartados, sinCalificar, criterio: { C, m } };
}

function printRankingTable(ranking, topN) {
  const evaluables = ranking.selected.length + ranking.descartados.length;
  console.log(
    `\n================ SELECCIÓN · los ${ranking.selected.length} mejores (de ${evaluables} con calificación evaluable) ================\n`
  );
  console.log(
    `Criterio: promedio bayesiano rating+nº reseñas (C=${ranking.criterio.C.toFixed(2)}, m=${ranking.criterio.m.toFixed(
      1
    )} reseñas). Objetivo: top ${Number.isFinite(topN) ? topN : 'todos'}.\n`
  );
  ranking.selected.forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${r.name} [${r.neighborhood}] — ★${r.google_rating} (${r.google_reviews_total} reseñas) — score=${r.ranking_score.toFixed(3)}`
    );
  });
  if (ranking.descartados.length) {
    console.log(`\n  (${ranking.descartados.length} más cumplían inclusión y tenían rating, pero no entraron al top ${topN})`);
  }
  if (ranking.sinCalificar.length) {
    console.log(
      `  (${ranking.sinCalificar.length} cumplen inclusión pero sin rating/reseñas de Google -> no se pudieron rankear, quedan fuera)`
    );
  }
}

// -----------------------------------------------------------------------------
// Reporte
// -----------------------------------------------------------------------------

function printZoneTable(records) {
  const zones = [...ZONES.map((z) => z.key), UNCLASSIFIED];
  console.log('\n================ FASE 1 · Google Places — restaurantes por zona ================\n');
  console.log(
    [
      'Zona'.padEnd(20),
      'Encontrados'.padStart(12),
      'Cumplen inclusión'.padStart(18),
      'Web/red'.padStart(9),
      'Dominio propio'.padStart(15),
    ].join('  ')
  );
  console.log('-'.repeat(80));
  const summary = {};
  for (const z of zones) {
    const inZone = records.filter((r) => r.neighborhood === z);
    const included = inZone.filter((r) => r.meets_inclusion);
    const withWeb = inZone.filter((r) => r.website);
    const withOwn = inZone.filter((r) => ownWebsiteOrNull(r.website));
    summary[z] = {
      encontrados: inZone.length,
      cumplen_inclusion: included.length,
      con_web_o_red: withWeb.length,
      con_dominio_propio: withOwn.length,
    };
    console.log(
      [
        z.padEnd(20),
        String(inZone.length).padStart(12),
        String(included.length).padStart(18),
        String(withWeb.length).padStart(9),
        String(withOwn.length).padStart(15),
      ].join('  ')
    );
  }
  console.log('-'.repeat(80));
  console.log(
    [
      'TOTAL'.padEnd(20),
      String(records.length).padStart(12),
      String(records.filter((r) => r.meets_inclusion).length).padStart(18),
      String(records.filter((r) => r.website).length).padStart(9),
      String(records.filter((r) => ownWebsiteOrNull(r.website)).length).padStart(15),
    ].join('  ')
  );
  console.log('\nDetalle por restaurante:\n');
  for (const z of zones) {
    const inZone = records.filter((r) => r.neighborhood === z);
    if (!inZone.length) continue;
    console.log(`  [${z}]`);
    for (const r of inZone) {
      const rating = r.google_rating != null ? `★${r.google_rating}` : '★—';
      const nrev = r.google_reviews_total != null ? `${r.google_reviews_total} reseñas` : 'sin reseñas';
      const web = r.website ? r.website : 'sin web';
      const precio = r.price_categoria || 'precio n/d';
      console.log(`    · ${r.name} — ${rating} (${nrev}) — ${precio} — ${web}`);
    }
    console.log('');
  }
  return summary;
}

function writeReport(payload) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nReporte metodológico escrito en: ${path.relative(process.cwd(), REPORT_PATH)}`);
}

// -----------------------------------------------------------------------------
// Orquestación
// -----------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  console.log('GSI · Recolección de datos de restaurantes gourmet en Villavicencio');
  console.log('Fuentes: Google Places API (principal) + scraping de páginas propias.\n');

  if (!GOOGLE_PLACES_API_KEY) {
    console.error(
      'ERROR: falta GOOGLE_PLACES_API_KEY en backend/.env\n' +
        '  1. Crea la clave en https://console.cloud.google.com/ (habilita "Places API").\n' +
        '  2. Añádela a backend/.env:  GOOGLE_PLACES_API_KEY=tu_clave\n' +
        '  3. Vuelve a ejecutar el script.'
    );
    process.exitCode = 1;
    return;
  }

  const startedAt = new Date();

  // ---- FASE 1: Google Places ----
  console.log('FASE 1 · Consultando Google Places...\n');
  const { records, perQueryRaw, centroids } = await collectFromPlaces(args);
  const zoneSummary = printZoneTable(records);

  // ---- Selección de los mejores N ----
  const ranking = rankAndSelectTop(records, args.top);
  printRankingTable(ranking, args.top);
  const selected = ranking.selected;

  const report = {
    generado: startedAt.toISOString(),
    ciudad: CITY,
    zonas_objetivo: ZONES.map((z) => z.key),
    centroides_zonas: centroids,
    poblacion_objetivo:
      'Establecimientos de comida gourmet (restaurantes, cafés y afines) en Centro Histórico, Barzal, La Rosita y Villacentro de Villavicencio con presencia online verificable.',
    tecnica:
      'Censo / muestreo exhaustivo vía Google Places API (New) — Text Search restringido al área de cada zona — y scraping complementario de páginas propias. Zona asignada por dirección o por centroide más cercano (radio ' +
      ZONE_CLASSIFY_RADIUS_KM +
      ' km).',
    parametros: {
      dry_run: args.dryRun,
      scraping: args.scraping,
      limit_por_zona: args.limit === Infinity ? null : args.limit,
      top: Number.isFinite(args.top) ? args.top : null,
    },
    fase1_google_places: {
      total_encontrados: records.length,
      resultados_por_consulta: perQueryRaw,
      por_zona: zoneSummary,
      cumplen_criterio_inclusion: records.filter((r) => r.meets_inclusion).length,
      excluidos: records
        .filter((r) => !r.meets_inclusion)
        .map((r) => ({ nombre: r.name, motivo: r.inclusion_reason })),
    },
    fase1_5_seleccion: {
      criterio: 'Promedio bayesiano rating+nº de reseñas (evita que un rating alto con pocas reseñas gane a uno más bajo con muchas)',
      C_rating_promedio: ranking.criterio.C,
      m_resenas_promedio: ranking.criterio.m,
      objetivo_top: Number.isFinite(args.top) ? args.top : null,
      seleccionados: ranking.selected.length,
      descartados_por_ranking: ranking.descartados.map((r) => ({
        nombre: r.name,
        rating: r.google_rating,
        resenas: r.google_reviews_total,
        score: r.ranking_score,
      })),
      sin_calificacion_para_rankear: ranking.sinCalificar.map((r) => r.name),
    },
    fase2_scraping: null,
    guardado_bd: null,
    restaurantes: [],
  };

  if (args.dryRun) {
    console.log(
      '\n[modo --dry-run] No se escribió nada en la base de datos ni se hizo scraping.\n' +
        'Revisa los números de arriba (y el top seleccionado). Si tienen sentido, ejecuta:  npm run collect-data'
    );
    report.restaurantes = selected.map(publicView);
    writeReport(report);
    await pool.end();
    return;
  }

  // ---- Migración de esquema ----
  console.log('\nFASE 1.5 · Verificando/aplicando migraciones de esquema...');
  await ensureSchema();

  // ---- FASE 2: Scraping complementario ----
  const scrapeStats = { intentados: 0, ok: 0, fallidos: 0, omitidos_no_propios: 0, fallos: [] };
  if (args.scraping) {
    const conWeb = selected.filter((r) => r.website);
    const propios = conWeb.filter((r) => ownWebsiteOrNull(r.website));
    scrapeStats.omitidos_no_propios = conWeb.length - propios.length;
    console.log(
      `\nFASE 2 · ${conWeb.length} con presencia web; ${propios.length} son dominio propio scrapeables ` +
        `(${scrapeStats.omitidos_no_propios} son redes/agregadores y se omiten). Delay ${SCRAPE_DELAY_MS} ms.\n`
    );
    for (const record of propios) {
      scrapeStats.intentados += 1;
      process.stdout.write(`  · ${record.name} (${record.website}) ... `);
      const scrape = await scrapeOwnSite(record);
      mergeRecord(record, scrape);
      if (scrape.ok) {
        scrapeStats.ok += 1;
        console.log(
          `OK [${scrape.rendered_with}] wifi=${scrape.has_wifi ?? '—'} niños=${scrape.kids_zone ?? '—'} menú=${scrape.menu_items.length}`
        );
      } else {
        scrapeStats.fallidos += 1;
        scrapeStats.fallos.push({ nombre: record.name, url: record.website, motivo: scrape.error });
        console.log(`FALLÓ (${scrape.error})`);
      }
      await sleep(SCRAPE_DELAY_MS);
    }
  } else {
    console.log('\nFASE 2 · Scraping omitido (--no-scraping).');
  }

  // ---- FASE 3: Fusión y guardado ----
  console.log('\nFASE 3 · Guardando en la base de datos (UPSERT)...\n');
  const dbStats = {
    inserted: 0,
    updated: 0,
    skipped_no_coords: 0,
    menu_inserted: 0,
    menu_skipped_has_items: 0,
  };
  for (const record of selected) {
    try {
      const id = await upsertRestaurant(record, dbStats);
      if (id) {
        if (record.menu_items.length) await saveMenuItems(id, record.menu_items, dbStats);
        await recalculateRatingAvg(pool, id);
      }
      record._db_id = id;
    } catch (err) {
      console.log(`  ! Error guardando "${record.name}": ${err.message}`);
    }
  }
  console.log(
    `  Insertados: ${dbStats.inserted} | Actualizados: ${dbStats.updated} | Omitidos (sin coords): ${dbStats.skipped_no_coords}`
  );
  console.log(
    `  Ítems de menú insertados: ${dbStats.menu_inserted} | Restaurantes con menú ya existente (no se tocó): ${dbStats.menu_skipped_has_items}`
  );

  // ---- FASE 3.5: Parqueadero compartido de centros comerciales ----
  const mallGroups = new Map(); // clave normalizada -> { mallName, restaurantIds: [] }
  for (const record of selected) {
    if (!record._db_id) continue;
    const mall = detectMall(record);
    if (!mall) continue;
    const key = norm(mall);
    if (!mallGroups.has(key)) mallGroups.set(key, { mallName: mall, restaurantIds: [] });
    mallGroups.get(key).restaurantIds.push(record._db_id);
  }

  const mallStats = { centros_detectados: mallGroups.size, restaurantes_afectados: 0, detalle: [] };

  if (mallGroups.size) {
    console.log(`\nFASE 3.5 · Parqueaderos de centros comerciales (${mallGroups.size} detectados)...\n`);
    for (const { mallName, restaurantIds } of mallGroups.values()) {
      const parkingName = `Parqueadero ${mallName}`;
      let parkingId;
      let reused = false;
      let coordsVia = null;

      const [existingParking] = await pool.query('SELECT id FROM parkings WHERE name = ? LIMIT 1', [parkingName]);
      if (existingParking.length) {
        parkingId = existingParking[0].id;
        reused = true;
      } else {
        let coords = await findMallReference(mallName);
        await sleep(SEARCH_DELAY_MS);
        if (!coords) {
          // Último recurso: coordenadas del primer restaurante de este CC.
          const [[refRow]] = await pool.query('SELECT lat, lng FROM restaurants WHERE id = ?', [restaurantIds[0]]);
          coords = { lat: refRow.lat, lng: refRow.lng, via: 'coordenadas del restaurante (sin dato de Google para el CC)' };
        }
        coordsVia = coords.via;
        const [ins] = await pool.query(
          "INSERT INTO parkings (name, type, lat, lng) VALUES (?, 'centro_comercial', ?, ?)",
          [parkingName, coords.lat, coords.lng]
        );
        parkingId = ins.insertId;
      }

      for (const rid of restaurantIds) {
        await pool.query('INSERT IGNORE INTO restaurant_parkings (restaurant_id, parking_id) VALUES (?, ?)', [
          rid,
          parkingId,
        ]);
        await pool.query("UPDATE restaurants SET parking_type = 'convenio' WHERE id = ? AND parking_type = 'no_disponible'", [
          rid,
        ]);
      }

      mallStats.restaurantes_afectados += restaurantIds.length;
      mallStats.detalle.push({
        centro_comercial: mallName,
        restaurantes: restaurantIds.length,
        parking_id: parkingId,
        reutilizado: reused,
        coordenadas_via: coordsVia,
      });
      console.log(
        `  · ${mallName}: ${restaurantIds.length} restaurante(s) -> parking_id=${parkingId} (${reused ? 'reutilizado' : 'creado'}${
          coordsVia ? ', ' + coordsVia : ''
        })`
      );
    }
  } else {
    console.log('\nFASE 3.5 · No se detectaron restaurantes en centros comerciales en esta selección.');
  }

  // ---- Reporte final ----
  report.fase2_scraping = {
    ejecutado: args.scraping,
    sitios_dominio_propio_intentados: scrapeStats.intentados,
    omitidos_por_ser_redes_o_agregadores: scrapeStats.omitidos_no_propios,
    scraping_exitoso: scrapeStats.ok,
    scraping_fallido: scrapeStats.fallidos,
    fallos: scrapeStats.fallos,
  };
  report.guardado_bd = dbStats;
  report.centros_comerciales = mallStats;
  report.restaurantes = selected.map(publicView);

  console.log('\n================ RESUMEN ================');
  console.log(`Total encontrados (Google Places): ${records.length}`);
  for (const [z, s] of Object.entries(zoneSummary)) {
    console.log(`  ${z.padEnd(18)} encontrados=${s.encontrados}  cumplen inclusión=${s.cumplen_inclusion}`);
  }
  console.log(`Cumplen criterio de inclusión del anteproyecto: ${records.filter((r) => r.meets_inclusion).length}`);
  console.log(`Seleccionados (top ${Number.isFinite(args.top) ? args.top : 'todos'} por rating+reseñas): ${selected.length}`);
  console.log(`Scraping exitoso: ${scrapeStats.ok} | fallido: ${scrapeStats.fallidos}`);
  console.log(`Centros comerciales detectados: ${mallStats.centros_detectados} (${mallStats.restaurantes_afectados} restaurantes)`);
  console.log(`BD -> insertados: ${dbStats.inserted} | actualizados: ${dbStats.updated}`);

  writeReport(report);
  await pool.end();
}

// Vista "publicable" de un registro para el reporte JSON (sin objetos internos).
function publicView(r) {
  return {
    nombre: r.name,
    direccion: r.address,
    zona: r.neighborhood,
    zona_asignada_por: r.zone_method,
    tipo_cocina: r.cuisine_type,
    rango_precios_categoria: r.price_categoria,
    rango_precios_simbolo: r.price_range,
    horarios: r.opening_hours,
    servicios: {
      parqueadero: r.parking_type && r.parking_type !== 'no_disponible' ? true : null,
      wifi: r.has_wifi,
      zona_ninos: r.kids_zone,
    },
    calificacion_google: r.google_rating,
    numero_resenas: r.google_reviews_total,
    ranking_score: r.ranking_score != null ? r.ranking_score : null,
    presencia_web_principal: r.website || r.google_maps_url,
    google_place_id: r.google_place_id,
    coordenadas: r.lat != null ? { lat: r.lat, lng: r.lng } : null,
    cumple_inclusion: r.meets_inclusion,
    motivo_inclusion: r.inclusion_reason,
    data_source: r.data_source,
    scraping_ok: r.scraped,
    scraping_error: r.scrape_error,
    menu_items_extraidos: r.menu_items.length,
    db_id: r._db_id || null,
  };
}

main().catch(async (err) => {
  console.error('\nERROR FATAL:', err.message);
  try {
    await pool.end();
  } catch (_) {
    /* noop */
  }
  process.exitCode = 1;
});
