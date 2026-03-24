const User = require('../models/User');
const {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeAccessToken,
  revokeRefreshToken,
  isRefreshTokenValid,
} = require('../services/auth.service');
const { successResponse } = require('../utils/apiResponse');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../utils/AppError');

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      throw new ConflictError(existing.email === email ? 'Email already in use' : 'Username already taken');
    }

    const user = await User.create({ username, email, password });
    const { token: accessToken } = signAccessToken(user._id.toString());
    const { token: refreshToken } = signRefreshToken(user._id.toString());
    await storeRefreshToken(user._id.toString(), refreshToken);

    return successResponse(res, {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken,
    }, 'Account created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated');
    }

    const { token: accessToken } = signAccessToken(user._id.toString());
    const { token: refreshToken } = signRefreshToken(user._id.toString());
    await storeRefreshToken(user._id.toString(), refreshToken);

    return successResponse(res, {
      user: user.toPublicJSON(),
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await revokeAccessToken(req.tokenJti);
    await revokeRefreshToken(req.user._id.toString());

    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new BadRequestError('Refresh token required');

    let decoded;
    try {
      decoded = await verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const valid = await isRefreshTokenValid(decoded.userId, token);
    if (!valid) throw new UnauthorizedError('Refresh token revoked');

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found');

    const { token: newAccessToken } = signAccessToken(user._id.toString());
    const { token: newRefreshToken } = signRefreshToken(user._id.toString());
    await storeRefreshToken(user._id.toString(), newRefreshToken);

    return successResponse(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res) {
  return successResponse(res, { user: req.user.toPublicJSON() });
}

module.exports = { register, login, logout, refreshToken, getMe };
