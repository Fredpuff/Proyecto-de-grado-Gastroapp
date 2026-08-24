const express = require('express');
const menuController = require('../controllers/menuController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Rutas de items de menú individuales (no anidadas), usadas para editar/borrar por id
router.put('/:id', requireAuth, requireRole('admin'), menuController.update);
router.delete('/:id', requireAuth, requireRole('admin'), menuController.remove);

module.exports = router;
