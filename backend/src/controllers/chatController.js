const pool = require('../config/db');
const { NEIGHBORHOODS } = require('./restaurantController');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_TIMEOUT_MS = 15000;

const PRICE_KEYWORDS = {
  cheap: ['economico', 'barato', 'barata', 'accesible', 'low cost'],
  expensive: ['caro', 'costoso', 'costosa', 'lujoso', 'lujosa', 'elegante', 'fino', 'fina']
};
const PARKING_KEYWORDS = ['parqueadero', 'parqueo', 'parking', 'estacionamiento'];
const WIFI_KEYWORDS = ['wifi', 'wi-fi', 'internet'];

const SYSTEM_PROMPT = `Eres el asistente de recomendaciones de GSI, una app de búsqueda de
restaurantes gourmet en Villavicencio, Colombia.

Reglas estrictas que debes seguir siempre:
1. SOLO puedes recomendar restaurantes que aparezcan en la lista de "restaurantes
   disponibles" que se te entrega en el mensaje del usuario. Nunca inventes nombres,
   platos, direcciones ni datos que no estén en esa lista.
2. Usa el restaurant_id exacto de la lista para cada recomendación.
3. Recomienda como máximo 3 restaurantes, los que mejor encajen con lo que pide el
   usuario (zona, precio, servicios, tipo de cocina, lo que digan las reseñas).
4. Si ningún restaurante encaja bien, dilo con honestidad en "intro" y recomienda
   los que más se acerquen, explicando la limitación en su "reason".
5. Responde SOLO con un objeto JSON con esta forma EXACTA, sin texto adicional,
   sin markdown y sin backticks:
   {"intro": "string", "recommendations": [{"restaurant_id": number, "reason": "string"}]}`;

const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' };

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[áéíóúñü]/g, (ch) => ACCENTS[ch]);
}

// Reglas simples de palabras clave para armar el pre-filtro SQL. No depende del
// modelo: si algo no se reconoce aquí, simplemente no se filtra por ese criterio
// (mejor traer restaurantes de más que dejar fuera al que sí encaja).
async function extractCriteria(message) {
  const normalized = normalize(message);
  const criteria = { neighborhood: null, priceIn: null, cuisine: null, parking: false, wifi: false };

  for (const n of NEIGHBORHOODS) {
    if (normalized.includes(normalize(n))) {
      criteria.neighborhood = n;
      break;
    }
  }

  if (PRICE_KEYWORDS.cheap.some((k) => normalized.includes(k))) {
    criteria.priceIn = ['$', '$$'];
  } else if (PRICE_KEYWORDS.expensive.some((k) => normalized.includes(k))) {
    criteria.priceIn = ['$$$', '$$$$'];
  }

  if (PARKING_KEYWORDS.some((k) => normalized.includes(k))) criteria.parking = true;
  if (WIFI_KEYWORDS.some((k) => normalized.includes(k))) criteria.wifi = true;

  const [cuisineRows] = await pool.query('SELECT DISTINCT cuisine_type FROM restaurants');
  for (const row of cuisineRows) {
    if (normalized.includes(normalize(row.cuisine_type))) {
      criteria.cuisine = row.cuisine_type;
      break;
    }
  }

  return criteria;
}

async function queryCandidates(criteria) {
  const where = [];
  const params = [];

  if (criteria.neighborhood) {
    where.push('r.neighborhood = ?');
    params.push(criteria.neighborhood);
  }
  if (criteria.cuisine) {
    where.push('r.cuisine_type = ?');
    params.push(criteria.cuisine);
  }
  if (criteria.priceIn) {
    where.push(`r.price_range IN (${criteria.priceIn.map(() => '?').join(', ')})`);
    params.push(...criteria.priceIn);
  }
  if (criteria.parking) where.push("r.parking_type != 'no_disponible'");
  if (criteria.wifi) where.push('r.has_wifi = TRUE');

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT r.*, (SELECT COUNT(*) FROM reviews rv WHERE rv.restaurant_id = r.id) AS review_count
     FROM restaurants r
     ${whereClause}
     ORDER BY r.rating_avg DESC, r.name ASC
     LIMIT 15`,
    params
  );
  return rows;
}

// Relaja el filtro progresivamente si quedó demasiado angosto, para nunca
// dejar al modelo sin candidatos reales sobre los que recomendar.
async function getCandidates(criteria) {
  let rows = await queryCandidates(criteria);
  if (rows.length === 0 && (criteria.cuisine || criteria.priceIn)) {
    rows = await queryCandidates({ ...criteria, cuisine: null, priceIn: null });
  }
  if (rows.length === 0 && criteria.neighborhood) {
    rows = await queryCandidates({});
  }
  return rows;
}

// Hasta 3 reseñas destacadas por restaurante (mejor calificadas primero).
async function getTopReviews(restaurantIds) {
  if (restaurantIds.length === 0) return {};

  const placeholders = restaurantIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT restaurant_id, rating, comment FROM (
       SELECT rv.restaurant_id, rv.rating, rv.comment,
              ROW_NUMBER() OVER (PARTITION BY rv.restaurant_id ORDER BY rv.rating DESC, rv.created_at DESC) AS rn
       FROM reviews rv
       WHERE rv.restaurant_id IN (${placeholders}) AND rv.comment IS NOT NULL AND rv.comment != ''
     ) t
     WHERE t.rn <= 3`,
    restaurantIds
  );

  const byRestaurant = {};
  for (const row of rows) {
    if (!byRestaurant[row.restaurant_id]) byRestaurant[row.restaurant_id] = [];
    byRestaurant[row.restaurant_id].push({ rating: row.rating, comment: row.comment });
  }
  return byRestaurant;
}

// Deja el historial en un formato válido para la API de Anthropic: solo
// role/content de texto, recortado, y sin dos turnos seguidos del mismo rol.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];

  const cleaned = [];
  for (const item of raw.slice(-6)) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') continue;
    const content = item.content.trim().slice(0, 800);
    if (!content) continue;

    if (cleaned.length && cleaned[cleaned.length - 1].role === item.role) {
      cleaned[cleaned.length - 1].content += `\n${content}`;
    } else {
      cleaned.push({ role: item.role, content });
    }
  }
  if (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned;
}

async function callClaude(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const err = new Error(errBody?.error?.message || `La API de Anthropic respondió ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error('La API de Anthropic devolvió una respuesta vacía');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseAiResponse(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  if (typeof parsed.intro !== 'string' || !Array.isArray(parsed.recommendations)) {
    throw new Error('Formato de respuesta inesperado del modelo');
  }
  return parsed;
}

function toPromptCandidate(row, reviewsByRestaurant) {
  return {
    restaurant_id: row.id,
    name: row.name,
    neighborhood: row.neighborhood,
    cuisine_type: row.cuisine_type,
    price_range: row.price_range,
    has_wifi: !!row.has_wifi,
    parking_type: row.parking_type,
    kids_zone: !!row.kids_zone,
    rating_avg: Number(row.rating_avg),
    review_count: row.review_count,
    top_reviews: (reviewsByRestaurant[row.id] || []).map((r) => ({ rating: r.rating, comment: r.comment }))
  };
}

// Respuesta amigable cuando la IA no está disponible o no se pudo interpretar
// su respuesta: se muestran igual restaurantes reales, sin razones inventadas.
function fallbackResponse(candidates) {
  return {
    message:
      'No pude generar una recomendación personalizada en este momento, pero aquí tienes ' +
      'algunas opciones bien valoradas que podrían interesarte:',
    recommendations: candidates.slice(0, 3).map((c) => ({ ...c, reason: '' }))
  };
}

// POST /api/chat/recommend
async function recommend(req, res, next) {
  try {
    const { message, conversationHistory } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'El mensaje es obligatorio' });
    }

    const criteria = await extractCriteria(message);
    const candidates = await getCandidates(criteria);

    if (candidates.length === 0) {
      return res.json({
        message: 'Todavía no tenemos restaurantes registrados que puedan encajar con tu búsqueda.',
        recommendations: []
      });
    }

    const reviewsByRestaurant = await getTopReviews(candidates.map((c) => c.id));
    const candidatesForPrompt = candidates.map((c) => toPromptCandidate(c, reviewsByRestaurant));
    const history = sanitizeHistory(conversationHistory);

    const messages = [
      ...history,
      {
        role: 'user',
        content:
          `Restaurantes disponibles (usa SOLO estos, no inventes otros):\n` +
          `${JSON.stringify(candidatesForPrompt)}\n\n` +
          `Petición del usuario: "${message.trim()}"`
      }
    ];

    let aiResult;
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY no está configurada en el backend');
      }
      const text = await callClaude(messages);
      aiResult = parseAiResponse(text);
    } catch (aiErr) {
      console.error('[chat] Error al generar recomendación con IA:', aiErr.message);
      return res.json(fallbackResponse(candidates));
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const recommendations = aiResult.recommendations
      .filter((r) => byId.has(Number(r.restaurant_id)))
      .slice(0, 3)
      .map((r) => ({
        ...byId.get(Number(r.restaurant_id)),
        reason: typeof r.reason === 'string' ? r.reason : ''
      }));

    res.json({ message: aiResult.intro, recommendations });
  } catch (err) {
    next(err);
  }
}

module.exports = { recommend };
