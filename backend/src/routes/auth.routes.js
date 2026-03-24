const router = require('express').Router();
const { register, login, logout, refreshToken, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authenticate, logout);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getMe);

module.exports = router;

