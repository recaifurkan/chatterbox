const { successResponse } = require('../utils/apiResponse');

/**
 * @param {import('../services/user.service')} userService
 */
function createUserController(userService) {
  async function getProfile(req, res, next) {
    try {
      const data = await userService.getProfile(req.params.userId);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  async function updateProfile(req, res, next) {
    try {
      const data = await userService.updateProfile(req.user._id, req.body);
      return successResponse(res, data, 'Profile updated');
    } catch (error) {
      next(error);
    }
  }

  async function uploadAvatar(req, res, next) {
    try {
      const data = await userService.uploadAvatar(req.user._id, req.file?.buffer);
      return successResponse(res, data, 'Avatar güncellendi');
    } catch (error) {
      next(error);
    }
  }

  async function setStatus(req, res, next) {
    try {
      const data = await userService.setStatus(req.user._id, req.body);
      return successResponse(res, data, 'Status updated');
    } catch (error) {
      next(error);
    }
  }

  async function blockUser(req, res, next) {
    try {
      await userService.blockUser(req.user._id, req.params.userId);
      return successResponse(res, null, 'User blocked');
    } catch (error) {
      next(error);
    }
  }

  async function unblockUser(req, res, next) {
    try {
      await userService.unblockUser(req.user._id, req.params.userId);
      return successResponse(res, null, 'User unblocked');
    } catch (error) {
      next(error);
    }
  }

  async function muteUser(req, res, next) {
    try {
      await userService.muteUser(req.user._id, req.params.userId);
      return successResponse(res, null, 'User muted');
    } catch (error) {
      next(error);
    }
  }

  async function searchUsers(req, res, next) {
    try {
      const data = await userService.searchUsers(req.query.q, req.user._id);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  return { getProfile, updateProfile, uploadAvatar, setStatus, blockUser, unblockUser, muteUser, searchUsers };
}

module.exports = createUserController;

