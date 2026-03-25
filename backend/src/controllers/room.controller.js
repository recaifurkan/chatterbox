const { successResponse, paginationMeta } = require('../utils/apiResponse');

/**
 * @param {import('../services/room.service')} roomService
 */
function createRoomController(roomService) {
  async function getRooms(req, res, next) {
    try {
      const { type, page = 1, limit = 20 } = req.query;
      const { rooms, total } = await roomService.getRooms({ type, page, limit });
      return successResponse(res, { rooms }, 'Rooms fetched', 200, paginationMeta(total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async function getMyRooms(req, res, next) {
    try {
      const data = await roomService.getMyRooms(req.user._id);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  async function getRoom(req, res, next) {
    try {
      const data = await roomService.getRoom(req.params.id, req.user._id);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  async function createRoom(req, res, next) {
    try {
      const { name, description, type, memberIds } = req.body;
      const data = await roomService.createRoom({ name, description, type, memberIds }, req.user._id);
      return successResponse(res, data, 'Room created', 201);
    } catch (error) {
      next(error);
    }
  }

  async function joinRoom(req, res, next) {
    try {
      const { room, alreadyMember } = await roomService.joinRoom(req.params.id, req.user._id, req.body.inviteCode);
      return successResponse(res, { room }, alreadyMember ? 'Already a member' : 'Joined room successfully');
    } catch (error) {
      next(error);
    }
  }

  async function leaveRoom(req, res, next) {
    try {
      await roomService.leaveRoom(req.params.id, req.user._id);
      return successResponse(res, null, 'Left room');
    } catch (error) {
      next(error);
    }
  }

  async function updateRoom(req, res, next) {
    try {
      const data = await roomService.updateRoom(req.params.id, req.user._id, req.body);
      return successResponse(res, data, 'Room updated');
    } catch (error) {
      next(error);
    }
  }

  async function deleteRoom(req, res, next) {
    try {
      await roomService.deleteRoom(req.params.id, req.user._id);
      return successResponse(res, null, 'Room deleted');
    } catch (error) {
      next(error);
    }
  }

  async function promoteUser(req, res, next) {
    try {
      const { userId, role } = req.body;
      await roomService.promoteUser(req.params.id, req.user._id, userId, role);
      return successResponse(res, null, 'Role updated');
    } catch (error) {
      next(error);
    }
  }

  async function getRoomMembers(req, res, next) {
    try {
      const data = await roomService.getRoomMembers(req.params.id, req.user._id);
      return successResponse(res, data);
    } catch (error) {
      next(error);
    }
  }

  async function addMember(req, res, next) {
    try {
      const data = await roomService.addMember(req.params.id, req.user._id, req.body.userId);
      return successResponse(res, data, 'Üye eklendi');
    } catch (error) {
      next(error);
    }
  }

  async function createOrGetDM(req, res, next) {
    try {
      const data = await roomService.createOrGetDM(req.user._id, req.body.targetUserId);
      return successResponse(res, data, 'DM odası hazır');
    } catch (error) {
      next(error);
    }
  }

  return {
    getRooms, getMyRooms, getRoom, createRoom, joinRoom,
    leaveRoom, updateRoom, deleteRoom, promoteUser,
    getRoomMembers, addMember, createOrGetDM,
  };
}

module.exports = createRoomController;

