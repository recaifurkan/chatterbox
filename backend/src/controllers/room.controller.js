const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const { successResponse, paginationMeta } = require('../utils/apiResponse');
const { ROOM_TYPES, ROOM_ROLES } = require('../utils/constants');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

async function getRooms(req, res, next) {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (type) query.type = type;
    else query.type = { $in: [ROOM_TYPES.PUBLIC] };

    const total = await Room.countDocuments(query);
    const rooms = await Room.find(query)
      .populate('createdBy', 'username avatarUrl')
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return successResponse(res, { rooms }, 'Rooms fetched', 200, paginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
}

async function getMyRooms(req, res, next) {
  try {
    const rooms = await Room.find({
      'members.user': req.user._id,
      isActive: true,
    })
      .populate('createdBy', 'username avatarUrl')
      .populate('lastMessage')
      .populate('members.user', 'username avatarUrl status isOnline')
      .sort({ lastActivity: -1 });

    return successResponse(res, { rooms });
  } catch (error) {
    next(error);
  }
}

async function getRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id)
      .populate('createdBy', 'username avatarUrl')
      .populate('members.user', 'username avatarUrl status isOnline');

    if (!room || !room.isActive) throw new NotFoundError('Room not found');

    if (room.type === ROOM_TYPES.PRIVATE && !room.isMember(req.user._id)) {
      throw new ForbiddenError('You are not a member of this room');
    }

    return successResponse(res, { room });
  } catch (error) {
    next(error);
  }
}

async function createRoom(req, res, next) {
  try {
    const { name, description, type = ROOM_TYPES.PUBLIC, memberIds = [] } = req.body;

    const room = await Room.create({
      name,
      description,
      type,
      createdBy: req.user._id,
      inviteCode: type === ROOM_TYPES.PRIVATE ? uuidv4() : undefined,
      members: [
        { user: req.user._id, role: ROOM_ROLES.OWNER },
        ...memberIds.filter((id) => id !== req.user._id.toString()).map((id) => ({
          user: id,
          role: ROOM_ROLES.MEMBER,
        })),
      ],
    });

    await room.populate('createdBy', 'username avatarUrl');
    return successResponse(res, { room }, 'Room created', 201);
  } catch (error) {
    next(error);
  }
}

async function joinRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) throw new NotFoundError('Room not found');

    if (room.type === ROOM_TYPES.PRIVATE) {
      const { inviteCode } = req.body;
      if (room.inviteCode !== inviteCode) throw new ForbiddenError('Invalid invite code');
    }

    if (room.type === ROOM_TYPES.DM) throw new ForbiddenError('Cannot join DM rooms');

    if (room.isMember(req.user._id)) {
      return successResponse(res, { room }, 'Already a member');
    }

    room.members.push({ user: req.user._id, role: ROOM_ROLES.MEMBER });
    await room.save();

    return successResponse(res, { room }, 'Joined room successfully');
  } catch (error) {
    next(error);
  }
}

async function leaveRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    if (!room.isMember(req.user._id)) throw new BadRequestError('Not a member');

    if (room.hasRole(req.user._id, ROOM_ROLES.OWNER)) {
      throw new BadRequestError('Owner cannot leave without transferring ownership first');
    }

    room.members = room.members.filter((m) => m.user.toString() !== req.user._id.toString());
    await room.save();

    return successResponse(res, null, 'Left room');
  } catch (error) {
    next(error);
  }
}

async function updateRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) throw new NotFoundError('Room not found');

    if (!room.hasRole(req.user._id, [ROOM_ROLES.OWNER, ROOM_ROLES.ADMIN])) {
      throw new ForbiddenError('Permission denied');
    }

    const { name, description } = req.body;
    if (name) room.name = name;
    if (description !== undefined) room.description = description;
    await room.save();

    return successResponse(res, { room }, 'Room updated');
  } catch (error) {
    next(error);
  }
}

async function deleteRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    if (!room.hasRole(req.user._id, ROOM_ROLES.OWNER)) {
      throw new ForbiddenError('Only the owner can delete this room');
    }

    room.isActive = false;
    await room.save();

    return successResponse(res, null, 'Room deleted');
  } catch (error) {
    next(error);
  }
}

async function promoteUser(req, res, next) {
  try {
    const { userId, role } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    if (!room.hasRole(req.user._id, [ROOM_ROLES.OWNER, ROOM_ROLES.ADMIN])) {
      throw new ForbiddenError('Permission denied');
    }

    const allowedRoles = [ROOM_ROLES.ADMIN, ROOM_ROLES.MODERATOR, ROOM_ROLES.MEMBER];
    if (!allowedRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Allowed: ${allowedRoles.join(', ')}`);
    }

    const member = room.members.find((m) => m.user.toString() === userId);
    if (!member) throw new NotFoundError('User is not a member');

    member.role = role;
    await room.save();

    return successResponse(res, null, 'Role updated');
  } catch (error) {
    next(error);
  }
}

async function getRoomMembers(req, res, next) {
  try {
    const room = await Room.findById(req.params.id).populate('members.user', 'username avatarUrl status isOnline');
    if (!room) throw new NotFoundError('Room not found');

    if (room.type === ROOM_TYPES.PRIVATE && !room.isMember(req.user._id)) {
      throw new ForbiddenError('Access denied');
    }

    return successResponse(res, { members: room.members });
  } catch (error) {
    next(error);
  }
}

async function addMember(req, res, next) {
  try {
    const { userId } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) throw new NotFoundError('Oda bulunamadı');

    if (!room.hasRole(req.user._id, [ROOM_ROLES.OWNER, ROOM_ROLES.ADMIN])) {
      throw new ForbiddenError('Bu işlem için yetkiniz yok');
    }
    if (room.isMember(userId)) throw new ConflictError('Kullanıcı zaten üye');

    room.members.push({ user: userId, role: ROOM_ROLES.MEMBER });
    await room.save();
    await room.populate('members.user', 'username avatarUrl status isOnline');
    return successResponse(res, { members: room.members }, 'Üye eklendi');
  } catch (error) {
    next(error);
  }
}

/**
 * Mevcut DM odasını döndürür veya yoksa oluşturur.
 * Mesaj göndermeden sadece oda açmak için kullanılır.
 */
async function createOrGetDM(req, res, next) {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) throw new BadRequestError('targetUserId gerekli');
    if (targetUserId === req.user._id.toString()) {
      throw new BadRequestError('Kendinize DM atamazsınız');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new NotFoundError('Kullanıcı bulunamadı');

    // Engel kontrolü
    if (targetUser.blockedUsers?.some((id) => id.toString() === req.user._id.toString())) {
      throw new ForbiddenError('Bu kullanıcı sizi engelledi');
    }

    // Mevcut DM odasını bul
    let room = await Room.findOne({
      type: ROOM_TYPES.DM,
      'members.user': { $all: [req.user._id, targetUserId] },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    }).populate('members.user', 'username avatarUrl status isOnline');

    if (!room) {
      room = await Room.create({
        name: `dm_${String(req.user._id).slice(-8)}_${String(targetUserId).slice(-8)}`,
        type: ROOM_TYPES.DM,
        createdBy: req.user._id,
        members: [
          { user: req.user._id, role: ROOM_ROLES.MEMBER },
          { user: targetUserId, role: ROOM_ROLES.MEMBER },
        ],
      });
      await room.populate('members.user', 'username avatarUrl status isOnline');
    }

    return successResponse(res, { room }, 'DM odası hazır');
  } catch (error) {
    next(error);
  }
}

module.exports = { getRooms, getMyRooms, getRoom, createRoom, joinRoom, leaveRoom, updateRoom, deleteRoom, promoteUser, getRoomMembers, addMember, createOrGetDM };

