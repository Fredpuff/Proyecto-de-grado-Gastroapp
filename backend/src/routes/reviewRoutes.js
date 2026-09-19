const express = require('express');
const reviewController = require('../controllers/reviewController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/reanalyze', requireAuth, requireRole('admin'), reviewController.reanalyze);

module.exports = router;
