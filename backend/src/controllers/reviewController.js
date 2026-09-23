const pool = require('../config/db');
const { recalculateRatingAvg } = require('../utils/ratingAvg');
const {
  getRestaurantInsights,
  reanalyzePending,
  analyzeReviewSafe,
  refreshRestaurantInsights
} = require('../services/reviewNlp.service');

// GET /api/restaurants/:restaurantId/reviews
async function listByRestaurant(req, res, next) {
  try {
    const restaurantId = Number(req.params.restaurantId);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return res.status(400).json({ message: 'restaurantId inválido' });
    }

    const [rows] = await pool.query(
      `SELECT rv.id, rv.rating, rv.comment, rv.created_at, rv.sentiment, rv.sentiment_score,
              u.id AS user_id, u.name AS user_name
       FROM reviews rv
       JOIN users u ON u.id = rv.user_id
       WHERE rv.restaurant_id = ?
       ORDER BY rv.created_at DESC`,
      [restaurantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/restaurants/:restaurantId/reviews (usuario autenticado)
// Al guardar, recalcula rating_avg combinando esta reseña (y las demás de la
// app) con la calificación de Google recolectada por collectRestaurantData.js.
async function create(req, res, next) {
  try {
    const { rating, comment = null } = req.body;
    const restaurantId = Number(req.params.restaurantId);

    // Number(rating) + Number.isInteger evita el bypass por NaN: con el
    // operador `<`/`>` original, un rating no numérico (ej. "abc" u objetos)
    // nunca es < 1 ni > 5 porque cualquier comparación con NaN es false, así
    // que pasaba la validación y llegaba crudo al INSERT.
    const ratingNum = Number(rating);
    if (rating === undefined || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'rating es obligatorio y debe ser un entero entre 1 y 5' });
    }

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return res.status(400).json({ message: 'restaurantId inválido' });
    }

    const [restaurantRows] = await pool.query('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
    if (restaurantRows.length === 0) {
      return res.status(404).json({ message: 'Restaurante no encontrado' });
    }

    const [result] = await pool.query(
      'INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [restaurantId, req.user.id, ratingNum, comment]
    );

    // Análisis de sentimiento en segundo plano: sin await, no debe retrasar
    // la respuesta al cliente. analyzeReviewSafe nunca lanza, pero el .catch
    // evita una advertencia de "unhandled rejection" si algo inesperado pasa.
    // Si el análisis queda 'done', refresca también los agregados del
    // restaurante: si no, GET /insights se queda con datos viejos hasta que
    // alguien corra el backfill o /reviews/reanalyze manualmente.
    analyzeReviewSafe(result.insertId)
      .then((analysis) => {
        if (analysis.status === 'done') return refreshRestaurantInsights(restaurantId);
      })
      .catch((err) => {
        console.error(`[reviewController] No se pudieron refrescar los insights del restaurante ${restaurantId}:`, err.message);
      });

    await recalculateRatingAvg(pool, restaurantId);

    const [rows] = await pool.query(
      `SELECT rv.id, rv.rating, rv.comment, rv.created_at, rv.sentiment, rv.sentiment_score,
              u.id AS user_id, u.name AS user_name
       FROM reviews rv JOIN users u ON u.id = rv.user_id WHERE rv.id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/restaurants/:restaurantId/insights (público)
async function getInsights(req, res, next) {
  try {
    const restaurantId = Number(req.params.restaurantId);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return res.status(400).json({ message: 'restaurantId inválido' });
    }

    const row = await getRestaurantInsights(restaurantId);

    if (!row) {
      return res.json({
        totalAnalyzed: 0,
        sentimentIndex: null,
        counts: { positivo: 0, neutral: 0, negativo: 0, mixto: 0 },
        aspects: [],
        keywords: [],
        summary: null,
        updatedAt: null
      });
    }

    let aspectScores = row.aspect_scores;
    if (typeof aspectScores === 'string') {
      try {
        aspectScores = JSON.parse(aspectScores);
      } catch {
        aspectScores = {};
      }
    }
    aspectScores = aspectScores || {};

    let topKeywords = row.top_keywords;
    if (typeof topKeywords === 'string') {
      try {
        topKeywords = JSON.parse(topKeywords);
      } catch {
        topKeywords = [];
      }
    }
    topKeywords = topKeywords || [];

    const aspects = Object.entries(aspectScores)
      .map(([aspect, v]) => ({
        aspect,
        score: Number(v.score),
        mentions: Number(v.mentions),
        positive: Number(v.positive),
        negative: Number(v.negative)
      }))
      .sort((a, b) => b.mentions - a.mentions);

    const avgScore = row.avg_score !== null && row.avg_score !== undefined ? Number(row.avg_score) : null;
    const sentimentIndex = avgScore !== null ? Math.round(((avgScore + 1) / 2) * 100) : null;

    res.json({
      totalAnalyzed: Number(row.total_analyzed) || 0,
      sentimentIndex,
      counts: {
        positivo: Number(row.positive_count) || 0,
        neutral: Number(row.neutral_count) || 0,
        negativo: Number(row.negative_count) || 0,
        mixto: Number(row.mixed_count) || 0
      },
      aspects,
      keywords: topKeywords,
      summary: row.summary || null,
      updatedAt: row.updated_at
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/reviews/reanalyze (admin) — reprocesa reseñas pending/failed
async function reanalyze(req, res, next) {
  try {
    const body = req.body || {};

    let limit = Number(body.limit) || 100;
    limit = Math.min(Math.max(limit, 1), 100);

    let restaurantId = null;
    if (body.restaurantId !== undefined && body.restaurantId !== null) {
      restaurantId = Number(body.restaurantId);
      if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
        return res.status(400).json({ message: 'restaurantId inválido' });
      }
    }

    const counts = await reanalyzePending({ limit, concurrency: 3, restaurantId });
    res.json(counts);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByRestaurant, create, getInsights, reanalyze };
