const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { REDIS_KEYS } = require('../utils/constants');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../utils/AppError');

class AuthService {
  /**
   * @param {{ User: import('mongoose').Model, redisService: import('./redis.service') }} deps
   */
  constructor({ User, redisService }) {
    this.User = User;
    this.redisService = redisService;
  }

  // ── Token operations ────────────────────────────────────────────────────

  signAccessToken(userId) {
    const jti = uuidv4();
    const token = jwt.sign({ userId, jti }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });
    return { token, jti };
  }

  signRefreshToken(userId) {
    const jti = uuidv4();
    const token = jwt.sign({ userId, jti, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
    return { token, jti };
  }

  async storeRefreshToken(userId, token) {
    const ttl = 7 * 24 * 60 * 60;
    await this.redisService.setex(REDIS_KEYS.REFRESH_TOKEN(userId), ttl, token);
  }

  async verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }

  async revokeAccessToken(jti, expiresIn) {
    const ttl = expiresIn ?? 900;
    await this.redisService.setex(REDIS_KEYS.BLACKLISTED_TOKEN(jti), ttl, '1');
  }

  async revokeRefreshToken(userId) {
    await this.redisService.del(REDIS_KEYS.REFRESH_TOKEN(userId));
  }

  async isRefreshTokenValid(userId, token) {
    const stored = await this.redisService.get(REDIS_KEYS.REFRESH_TOKEN(userId));
    return stored === token;
  }

  // ── Business logic ──────────────────────────────────────────────────────

  async register(username, email, password) {
    const existing = await this.User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      throw new ConflictError(existing.email === email ? 'Email already in use' : 'Username already taken');
    }

    const user = await this.User.create({ username, email, password });
    const { token: accessToken } = this.signAccessToken(user._id.toString());
    const { token: refreshToken } = this.signRefreshToken(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), refreshToken);

    return { user: user.toPublicJSON(), accessToken, refreshToken };
  }

  async login(email, password) {
    const user = await this.User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated');
    }

    const { token: accessToken } = this.signAccessToken(user._id.toString());
    const { token: refreshToken } = this.signRefreshToken(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), refreshToken);

    return { user: user.toPublicJSON(), accessToken, refreshToken };
  }

  async logout(userId, tokenJti) {
    await this.revokeAccessToken(tokenJti);
    await this.revokeRefreshToken(userId);
  }

  async refreshTokens(token) {
    if (!token) throw new BadRequestError('Refresh token required');

    let decoded;
    try {
      decoded = await this.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const valid = await this.isRefreshTokenValid(decoded.userId, token);
    if (!valid) throw new UnauthorizedError('Refresh token revoked');

    const user = await this.User.findById(decoded.userId);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found');

    const { token: newAccessToken } = this.signAccessToken(user._id.toString());
    const { token: newRefreshToken } = this.signRefreshToken(user._id.toString());
    await this.storeRefreshToken(user._id.toString(), newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}

module.exports = AuthService;

