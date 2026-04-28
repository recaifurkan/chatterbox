const router = require('express').Router();
const createAuthController = require('../controllers/auth.controller');
const { authService } = require('../container');
const { authenticate } = require('../container');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');

const { register, login, logout, refreshToken, getMe } = createAuthController(authService);

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authenticate, logout);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getMe);

module.exports = router;

