const jwt = require('jsonwebtoken');
const { REDIS_KEYS } = require('../utils/constants');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Factory — redisService enjekte edilir, doğrudan config/redis import edilmez.
 * @param {{ redisService: import('../services/redis.service') }} deps
 */
function createAuthMiddleware({ redisService }) {
  /**
   * Respond directly with 401/403 for auth errors so unit tests
   * (which run without the global error-handler middleware) work correctly.
   */
  async function authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('No token provided', { url: req.url, method: req.method });
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      let decoded;

      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          logger.warn('Token expired', { url: req.url, method: req.method });
          return res.status(401).json({ success: false, message: 'Token expired' });
        }
        logger.warn('Invalid token', { url: req.url, method: req.method });
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }

      // Check if token is blacklisted
      const isBlacklisted = await redisService.get(REDIS_KEYS.BLACKLISTED_TOKEN(decoded.jti));
      if (isBlacklisted) {
        logger.warn('Token revoked', { url: req.url, method: req.method });
        return res.status(401).json({ success: false, message: 'Token has been revoked' });
      }

      const user = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        logger.warn('User not found or inactive', { url: req.url, method: req.method });
        return res.status(401).json({ success: false, message: 'User not found or inactive' });
      }

      req.user = user;
      req.tokenJti = decoded.jti;
      next();
    } catch (error) {
      next(error);
    }
  }

  function authorize(...roles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        if (roles.length && !roles.includes(req.user.role)) {
          return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  return { authenticate, authorize };
}

module.exports = createAuthMiddleware;
