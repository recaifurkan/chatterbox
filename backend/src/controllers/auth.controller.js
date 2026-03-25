const { successResponse } = require('../utils/apiResponse');

/**
 * @param {import('../services/auth.service')} authService
 */
function createAuthController(authService) {
  async function register(req, res, next) {
    try {
      const { username, email, password } = req.body;
      const data = await authService.register(username, email, password);
      return successResponse(res, data, 'Account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async function login(req, res, next) {
    try {
      const { email, password } = req.body;
      const data = await authService.login(email, password);
      return successResponse(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async function logout(req, res, next) {
    try {
      await authService.logout(req.user._id.toString(), req.tokenJti);
      return successResponse(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async function refreshToken(req, res, next) {
    try {
      const data = await authService.refreshTokens(req.body.refreshToken);
      return successResponse(res, data, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  }

  async function getMe(req, res) {
    return successResponse(res, { user: req.user.toPublicJSON() });
  }

  return { register, login, logout, refreshToken, getMe };
}

module.exports = createAuthController;
