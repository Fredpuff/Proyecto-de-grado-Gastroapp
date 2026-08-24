const pool = require('../config/db');

// GET /api/restaurants/:restaurantId/reviews
async function listByRestaurant(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT rv.id, rv.rating, rv.comment, rv.created_at, u.id AS user_id, u.name AS user_name
       FROM reviews rv
       JOIN users u ON u.id = rv.user_id
       WHERE rv.restaurant_id = ?
       ORDER BY rv.created_at DESC`,
      [req.params.restaurantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/restaurants/:restaurantId/reviews (usuario autenticado)
// Solo almacenamiento: no hay análisis de sentimiento ni cálculo automático de promedio.
async function create(req, res, next) {
  try {
    const { rating, comment = null } = req.body;
    const restaurantId = req.params.restaurantId;

    if (rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating es obligatorio y debe estar entre 1 y 5' });
    }

    const [restaurantRows] = await pool.query('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
    if (restaurantRows.length === 0) {
      return res.status(404).json({ message: 'Restaurante no encontrado' });
    }

    const [result] = await pool.query(
      'INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [restaurantId, req.user.id, rating, comment]
    );

    const [rows] = await pool.query(
      `SELECT rv.id, rv.rating, rv.comment, rv.created_at, u.id AS user_id, u.name AS user_name
       FROM reviews rv JOIN users u ON u.id = rv.user_id WHERE rv.id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByRestaurant, create };
