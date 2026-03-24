const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');
const { REDIS_KEYS } = require('../utils/constants');
const User = require('../models/User');
const logger = require('../utils/logger');

async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1] ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      return next(new Error('Invalid token'));
    }

    // Check blacklist
    const redis = getRedisClient();
    const isBlacklisted = await redis.get(REDIS_KEYS.BLACKLISTED_TOKEN(decoded.jti));
    if (isBlacklisted) {
      return next(new Error('Token revoked'));
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    socket.userId = user._id.toString();

    logger.info(`Socket auth: ${user.username} (${socket.id})`);
    next();
  } catch (error) {
    logger.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
}

module.exports = { socketAuthMiddleware };

