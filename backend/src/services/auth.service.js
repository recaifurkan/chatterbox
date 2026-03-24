const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../config/redis');
const { REDIS_KEYS } = require('../utils/constants');

function signAccessToken(userId) {
  const jti = uuidv4();
  const token = jwt.sign({ userId, jti }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  return { token, jti };
}

function signRefreshToken(userId) {
  const jti = uuidv4();
  const token = jwt.sign({ userId, jti, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { token, jti };
}

async function storeRefreshToken(userId, token) {
  const redis = getRedisClient();
  const ttl = 7 * 24 * 60 * 60; // 7 days
  await redis.setex(REDIS_KEYS.REFRESH_TOKEN(userId), ttl, token);
}

async function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

async function revokeAccessToken(jti, expiresIn) {
  const redis = getRedisClient();
  // Use provided TTL or fallback to 900s (default 15m access token lifetime)
  const ttl = expiresIn ?? 900;
  await redis.setex(REDIS_KEYS.BLACKLISTED_TOKEN(jti), ttl, '1');
}

async function revokeRefreshToken(userId) {
  const redis = getRedisClient();
  await redis.del(REDIS_KEYS.REFRESH_TOKEN(userId));
}

async function isRefreshTokenValid(userId, token) {
  const redis = getRedisClient();
  const stored = await redis.get(REDIS_KEYS.REFRESH_TOKEN(userId));
  return stored === token;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeAccessToken,
  revokeRefreshToken,
  isRefreshTokenValid,
};

