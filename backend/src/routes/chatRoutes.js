const express = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/recommend', requireAuth, chatController.recommend);

module.exports = router;
