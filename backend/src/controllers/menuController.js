const pool = require('../config/db');

async function assertOwnership(restaurantId, userId) {
  const [rows] = await pool.query('SELECT owner_id FROM restaurants WHERE id = ?', [restaurantId]);
  if (rows.length === 0) {
    const err = new Error('Restaurante no encontrado');
    err.status = 404;
    throw err;
  }
  if (rows[0].owner_id !== userId) {
    const err = new Error('No tienes permisos sobre el menú de este restaurante');
    err.status = 403;
    throw err;
  }
}

// GET /api/restaurants/:restaurantId/menu
async function listByRestaurant(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name',
      [req.params.restaurantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/restaurants/:restaurantId/menu (admin dueño)
async function create(req, res, next) {
  try {
    await assertOwnership(req.params.restaurantId, req.user.id);

    const { name, price, category, description = null } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ message: 'name, price y category son obligatorios' });
    }

    const [result] = await pool.query(
      'INSERT INTO menu_items (restaurant_id, name, description, price, category) VALUES (?, ?, ?, ?, ?)',
      [req.params.restaurantId, name, description, price, category]
    );

    const [rows] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// PUT /api/menu/:id (admin dueño del restaurante asociado)
async function update(req, res, next) {
  try {
    const [itemRows] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Plato no encontrado' });
    }
    await assertOwnership(itemRows[0].restaurant_id, req.user.id);

    const allowedFields = ['name', 'description', 'price', 'category'];
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

    await pool.query(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/menu/:id (admin dueño del restaurante asociado)
async function remove(req, res, next) {
  try {
    const [itemRows] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Plato no encontrado' });
    }
    await assertOwnership(itemRows[0].restaurant_id, req.user.id);

    await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listByRestaurant, create, update, remove };
