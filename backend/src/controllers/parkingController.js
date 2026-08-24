const pool = require('../config/db');

// GET /api/parkings
async function list(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM parkings ORDER BY name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/parkings/:id
async function getById(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM parkings WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Parqueadero no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/parkings (admin)
// Body opcional: restaurant_ids: number[] para asociarlo a uno o varios restaurantes
async function create(req, res, next) {
  try {
    const { name, type, lat, lng, restaurant_ids = [] } = req.body;
    if (!name || !type || lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'name, type, lat y lng son obligatorios' });
    }
    if (!['propio', 'convenio', 'publico'].includes(type)) {
      return res.status(400).json({ message: 'type debe ser propio, convenio o publico' });
    }

    const [result] = await pool.query(
      'INSERT INTO parkings (name, type, lat, lng) VALUES (?, ?, ?, ?)',
      [name, type, lat, lng]
    );

    if (Array.isArray(restaurant_ids) && restaurant_ids.length > 0) {
      const values = restaurant_ids.map((rid) => [rid, result.insertId]);
      await pool.query('INSERT INTO restaurant_parkings (restaurant_id, parking_id) VALUES ?', [values]);
    }

    const [rows] = await pool.query('SELECT * FROM parkings WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// PUT /api/parkings/:id (admin)
async function update(req, res, next) {
  try {
    const allowedFields = ['name', 'type', 'lat', 'lng'];
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

    const [result] = await pool.query(`UPDATE parkings SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Parqueadero no encontrado' });
    }

    const [rows] = await pool.query('SELECT * FROM parkings WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/parkings/:id (admin)
async function remove(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM parkings WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Parqueadero no encontrado' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
