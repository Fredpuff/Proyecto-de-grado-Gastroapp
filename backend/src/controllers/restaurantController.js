const pool = require('../config/db');
const { haversineDistanceKm } = require('../utils/haversine');

const NEIGHBORHOODS = ['Centro Histórico', 'Barzal', 'La Rosita', 'Villacentro'];
const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'];
const PARKING_TYPES = ['propio', 'convenio', 'publico', 'no_disponible'];

// GET /api/restaurants - búsqueda con filtros combinables
async function list(req, res, next) {
  try {
    const { q, cuisine, priceRange, neighborhood, parking, wifi } = req.query;

    const where = [];
    const params = [];

    if (q) {
      where.push('(r.name LIKE ? OR r.cuisine_type LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (cuisine) {
      where.push('r.cuisine_type = ?');
      params.push(cuisine);
    }
    if (priceRange) {
      where.push('r.price_range = ?');
      params.push(priceRange);
    }
    if (neighborhood) {
      where.push('r.neighborhood = ?');
      params.push(neighborhood);
    }
    if (parking === 'true') {
      where.push("r.parking_type != 'no_disponible'");
    }
    if (wifi === 'true') {
      where.push('r.has_wifi = TRUE');
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT r.*,
              (SELECT COUNT(*) FROM reviews rv WHERE rv.restaurant_id = r.id) AS review_count
       FROM restaurants r
       ${whereClause}
       ORDER BY r.rating_avg DESC, r.name ASC`,
      params
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/restaurants/:id
async function getById(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Restaurante no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const required = [
    'name', 'address', 'neighborhood', 'cuisine_type', 'price_range',
    'opening_hours', 'parking_type', 'lat', 'lng'
  ];

  if (!partial) {
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`${field} es obligatorio`);
      }
    }
  }
  if (body.neighborhood && !NEIGHBORHOODS.includes(body.neighborhood)) {
    errors.push(`neighborhood debe ser uno de: ${NEIGHBORHOODS.join(', ')}`);
  }
  if (body.price_range && !PRICE_RANGES.includes(body.price_range)) {
    errors.push(`price_range debe ser uno de: ${PRICE_RANGES.join(', ')}`);
  }
  if (body.parking_type && !PARKING_TYPES.includes(body.parking_type)) {
    errors.push(`parking_type debe ser uno de: ${PARKING_TYPES.join(', ')}`);
  }
  return errors;
}

// POST /api/restaurants (solo admin)
async function create(req, res, next) {
  try {
    const errors = validatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: 'Datos inválidos', errors });
    }

    const {
      name, address, neighborhood, cuisine_type, price_range, opening_hours,
      phone = null, website = null, has_wifi = false, parking_type,
      kids_zone = false, rating_avg = 0, image_url = null, lat, lng
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO restaurants
        (owner_id, name, address, neighborhood, cuisine_type, price_range, opening_hours,
         phone, website, has_wifi, parking_type, kids_zone, rating_avg, image_url, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, name, address, neighborhood, cuisine_type, price_range, opening_hours,
        phone, website, !!has_wifi, parking_type, !!kids_zone, rating_avg, image_url, lat, lng
      ]
    );

    const [rows] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function assertOwnership(req) {
  const [rows] = await pool.query('SELECT owner_id FROM restaurants WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    const err = new Error('Restaurante no encontrado');
    err.status = 404;
    throw err;
  }
  if (rows[0].owner_id !== req.user.id) {
    const err = new Error('No tienes permisos sobre este restaurante');
    err.status = 403;
    throw err;
  }
}

// PUT /api/restaurants/:id (solo admin dueño)
async function update(req, res, next) {
  try {
    await assertOwnership(req);

    const errors = validatePayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ message: 'Datos inválidos', errors });
    }

    const allowedFields = [
      'name', 'address', 'neighborhood', 'cuisine_type', 'price_range', 'opening_hours',
      'phone', 'website', 'has_wifi', 'parking_type', 'kids_zone', 'rating_avg',
      'image_url', 'lat', 'lng'
    ];
    const updates = [];
    const params = [];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No se enviaron campos para actualizar' });
    }
    params.push(req.params.id);

    await pool.query(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/restaurants/:id (solo admin dueño)
async function remove(req, res, next) {
  try {
    await assertOwnership(req);
    await pool.query('DELETE FROM restaurants WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// GET /api/restaurants/:id/nearby-parkings?radiusKm=1.5
// Calcula distancia con Haversine entre el restaurante y todos los parqueaderos,
// devolviendo los que están dentro del radio, ordenados por cercanía.
async function nearbyParkings(req, res, next) {
  try {
    const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm) : 1.5;

    const [restaurantRows] = await pool.query(
      'SELECT id, lat, lng FROM restaurants WHERE id = ?',
      [req.params.id]
    );
    if (restaurantRows.length === 0) {
      return res.status(404).json({ message: 'Restaurante no encontrado' });
    }
    const restaurant = restaurantRows[0];

    const [parkingRows] = await pool.query('SELECT * FROM parkings');

    const withDistance = parkingRows
      .map((p) => ({
        ...p,
        distance_km: Number(
          haversineDistanceKm(restaurant.lat, restaurant.lng, p.lat, p.lng).toFixed(3)
        )
      }))
      .filter((p) => p.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);

    res.json(withDistance);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove, nearbyParkings, NEIGHBORHOODS, PRICE_RANGES };
