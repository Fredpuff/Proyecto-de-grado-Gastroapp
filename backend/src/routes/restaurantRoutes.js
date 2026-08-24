const express = require('express');
const restaurantController = require('../controllers/restaurantController');
const menuController = require('../controllers/menuController');
const reviewController = require('../controllers/reviewController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Restaurantes
router.get('/', restaurantController.list);
router.get('/:id', restaurantController.getById);
router.post('/', requireAuth, requireRole('admin'), restaurantController.create);
router.put('/:id', requireAuth, requireRole('admin'), restaurantController.update);
router.delete('/:id', requireAuth, requireRole('admin'), restaurantController.remove);
router.get('/:id/nearby-parkings', restaurantController.nearbyParkings);

// Menú anidado bajo un restaurante
router.get('/:restaurantId/menu', menuController.listByRestaurant);
router.post('/:restaurantId/menu', requireAuth, requireRole('admin'), menuController.create);

// Reseñas anidadas bajo un restaurante
router.get('/:restaurantId/reviews', reviewController.listByRestaurant);
router.post('/:restaurantId/reviews', requireAuth, requireRole('cliente', 'admin'), reviewController.create);

module.exports = router;
