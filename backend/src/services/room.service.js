const { v4: uuidv4 } = require('uuid');
const { ROOM_TYPES, ROOM_ROLES } = require('../utils/constants');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

class RoomService {
  constructor({ Room, User, Message }) {
    this.Room = Room;
    this.User = User;
    this.Message = Message;
  }

  async getRooms({ type, page = 1, limit = 20 } = {}) {
    const query = { isActive: true };
    if (type) query.type = type;
    else query.type = { $in: [ROOM_TYPES.PUBLIC] };

    const total = await this.Room.countDocuments(query);
    const rooms = await this.Room.find(query)
      .populate('createdBy', 'username avatarUrl')
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return { rooms, total };
  }

  async getMyRooms(userId) {
    const rooms = await this.Room.find({
      'members.user': userId,
      isActive: true,
    })
      .populate('createdBy', 'username avatarUrl')
      .populate('lastMessage')
      .populate('members.user', 'username avatarUrl status isOnline')
      .sort({ lastActivity: -1 });

    return { rooms };
  }

  async getRoom(roomId, userId) {
    const room = await this.Room.findById(roomId)
      .populate('createdBy', 'username avatarUrl')
      .populate('members.user', 'username avatarUrl status isOnline');

    if (!room || !room.isActive) throw new NotFoundError('Room not found');

    if (room.type === ROOM_TYPES.PRIVATE && !room.isMember(userId)) {
      throw new ForbiddenError('You are not a member of this room');
    }

    return { room };
  }

  async createRoom({ name, description, type = ROOM_TYPES.PUBLIC, memberIds = [] }, userId) {
    const room = await this.Room.create({
      name,
      description,
      type,
      createdBy: userId,
      inviteCode: type === ROOM_TYPES.PRIVATE ? uuidv4() : undefined,
      members: [
        { user: userId, role: ROOM_ROLES.OWNER },
        ...memberIds.filter((id) => id !== userId.toString()).map((id) => ({
          user: id,
          role: ROOM_ROLES.MEMBER,
        })),
      ],
    });

    await room.populate('createdBy', 'username avatarUrl');
    return { room };
  }

  async joinRoom(roomId, userId, inviteCode) {
    const room = await this.Room.findById(roomId);
    if (!room || !room.isActive) throw new NotFoundError('Room not found');

    if (room.type === ROOM_TYPES.PRIVATE) {
      if (room.inviteCode !== inviteCode) throw new ForbiddenError('Invalid invite code');
    }

    if (room.type === ROOM_TYPES.DM) throw new ForbiddenError('Cannot join DM rooms');

    if (room.isMember(userId)) {
      return { room, alreadyMember: true };
    }

    room.members.push({ user: userId, role: ROOM_ROLES.MEMBER });
    await room.save();

    return { room, alreadyMember: false };
  }

  async leaveRoom(roomId, userId) {
    const room = await this.Room.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    if (!room.isMember(userId)) throw new BadRequestError('Not a member');

    if (room.hasRole(userId, ROOM_ROLES.OWNER)) {
      throw new BadRequestError('Owner cannot leave without transferring ownership first');
    }

    room.members = room.members.filter((m) => m.user.toString() !== userId.toString());
    await room.save();
  }

  async updateRoom(roomId, userId, { name, description }) {
    const room = await this.Room.findById(roomId);
    if (!room || !room.isActive) throw new NotFoundError('Room not found');

    if (!room.hasRole(userId, [ROOM_ROLES.OWNER, ROOM_ROLES.ADMIN])) {
      throw new ForbiddenError('Permission denied');
    }

    if (name) room.name = name;
    if (description !== undefined) room.description = description;
    await room.save();

    return { room };
  }

  async deleteRoom(roomId, userId) {
    const room = await this.Room.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    if (!room.hasRole(userId, ROOM_ROLES.OWNER)) {
      throw new ForbiddenError('Only the owner can delete this room');
    }

    room.isActive = false;
    await room.save();
  }

  async promoteUser(roomId, actorId, targetUserId, role) {
    const room = await this.Room.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    if (!room.hasRole(actorId, [ROOM_ROLES.OWNER, ROOM_ROLES.ADMIN])) {
      throw new ForbiddenError('Permission denied');
    }

    const allowedRoles = [ROOM_ROLES.ADMIN, ROOM_ROLES.MODERATOR, ROOM_ROLES.MEMBER];
    if (!allowedRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Allowed: ${allowedRoles.join(', ')}`);
    }

    const member = room.members.find((m) => m.user.toString() === targetUserId);
    if (!member) throw new NotFoundError('User is not a member');

    member.role = role;
    await room.save();
  }

  async getRoomMembers(roomId, userId) {
    const room = await this.Room.findById(roomId)
      .populate('members.user', 'username avatarUrl status isOnline');
    if (!room) throw new NotFoundError('Room not found');

    if (room.type === ROOM_TYPES.PRIVATE && !room.isMember(userId)) {
      throw new ForbiddenError('Access denied');
    }

    return { members: room.members };
  }

  async addMember(roomId, actorId, targetUserId) {
    const room = await this.Room.findById(roomId);
    if (!room || !room.isActive) throw new NotFoundError('Oda bulunamadı');

    if (!room.hasRole(actorId, [ROOM_ROLES.OWNER, ROOM_ROLES.ADMIN])) {
      throw new ForbiddenError('Bu işlem için yetkiniz yok');
    }
    if (room.isMember(targetUserId)) throw new ConflictError('Kullanıcı zaten üye');

    room.members.push({ user: targetUserId, role: ROOM_ROLES.MEMBER });
    await room.save();
    await room.populate('members.user', 'username avatarUrl status isOnline');
    return { members: room.members };
  }

  async createOrGetDM(userId, targetUserId) {
    if (!targetUserId) throw new BadRequestError('targetUserId gerekli');
    if (targetUserId === userId.toString()) {
      throw new BadRequestError('Kendinize DM atamazsınız');
    }

    const targetUser = await this.User.findById(targetUserId);
    if (!targetUser) throw new NotFoundError('Kullanıcı bulunamadı');

    if (targetUser.blockedUsers?.some((id) => id.toString() === userId.toString())) {
      throw new ForbiddenError('Bu kullanıcı sizi engelledi');
    }

    let room = await this.Room.findOne({
      type: ROOM_TYPES.DM,
      'members.user': { $all: [userId, targetUserId] },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    }).populate('members.user', 'username avatarUrl status isOnline');

    if (!room) {
      room = await this.Room.create({
        name: `dm_${String(userId).slice(-8)}_${String(targetUserId).slice(-8)}`,
        type: ROOM_TYPES.DM,
        createdBy: userId,
        members: [
          { user: userId, role: ROOM_ROLES.MEMBER },
          { user: targetUserId, role: ROOM_ROLES.MEMBER },
        ],
      });
      await room.populate('members.user', 'username avatarUrl status isOnline');
    }

    return { room };
  }
}

module.exports = RoomService;

