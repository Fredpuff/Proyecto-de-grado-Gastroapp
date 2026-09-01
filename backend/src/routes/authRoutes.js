const express = require('express');
const { register, login, googleLogin, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', requireAuth, me);

module.exports = router;
