const express = require('express');
const parkingController = require('../controllers/parkingController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', parkingController.list);
router.get('/:id', parkingController.getById);
router.post('/', requireAuth, requireRole('admin'), parkingController.create);
router.put('/:id', requireAuth, requireRole('admin'), parkingController.update);
router.delete('/:id', requireAuth, requireRole('admin'), parkingController.remove);

module.exports = router;
