const { v4: uuidv4 } = require('uuid');
const { SOCKET_EVENTS } = require('../utils/constants');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

class UserService {
  /**
   * @param {{
   *   User: import('mongoose').Model,
   *   presenceService: import('./presence.service'),
   *   getIO: () => import('socket.io').Server,
   *   filesystemService: import('./filesystem.service'),
   *   mediaService: import('./media.service')
   * }} deps
   */
  constructor({ User, presenceService, getIO, filesystemService, mediaService }) {
    this.User = User;
    this.presenceService = presenceService;
    this.getIO = getIO;
    this.filesystemService = filesystemService;
    this.mediaService = mediaService;
  }

  async getProfile(userId) {
    const user = await this.User.findById(userId).select('-password -blockedUsers -mutedUsers');
    if (!user) throw new NotFoundError('User not found');

    const presence = await this.presenceService.getUserPresence(userId);
    return { user: { ...user.toPublicJSON(), ...presence } };
  }

  async updateProfile(userId, { username, bio, statusMessage }) {
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (statusMessage !== undefined) updates.statusMessage = statusMessage;

    if (username) {
      const existing = await this.User.findOne({ username, _id: { $ne: userId } });
      if (existing) throw new ConflictError('Username already taken');
    }

    const user = await this.User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });

    return { user: user.toPublicJSON() };
  }

  async uploadAvatar(userId, fileBuffer) {
    if (!fileBuffer) throw new BadRequestError('Dosya bulunamadı');

    let jpegBuffer;
    try {
      jpegBuffer = await this.mediaService.processAvatar(fileBuffer, 256);
    } catch {
      throw new BadRequestError('Resim formatı desteklenmiyor. Lütfen JPEG, PNG, WebP veya HEIC kullanın.');
    }

    // Eski avatarı sil
    const oldUser = await this.User.findById(userId);
    if (oldUser.avatarUrl) {
      const oldObjectName = this.filesystemService.extractObjectName(oldUser.avatarUrl);
      if (oldObjectName) await this.filesystemService.delete(oldObjectName);
    }

    const objectName = `avatars/${userId}_${uuidv4()}.jpg`;
    const avatarUrl = await this.filesystemService.upload(objectName, jpegBuffer, 'image/jpeg');

    const user = await this.User.findByIdAndUpdate(userId, { avatarUrl }, { new: true });
    return { avatarUrl: user.avatarUrl };
  }

  async setStatus(userId, { status, statusMessage }) {
    const updates = {};
    if (status) updates.status = status;
    if (statusMessage !== undefined) updates.statusMessage = statusMessage;

    const user = await this.User.findByIdAndUpdate(userId, updates, { new: true });

    const io = this.getIO();
    io.emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
      userId: user._id,
      status: user.status,
      statusMessage: user.statusMessage,
    });

    return { status: user.status, statusMessage: user.statusMessage };
  }

  async blockUser(userId, targetUserId) {
    if (targetUserId === userId.toString()) throw new BadRequestError('Cannot block yourself');

    const target = await this.User.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');

    await this.User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetUserId } });
  }

  async unblockUser(userId, targetUserId) {
    await this.User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetUserId } });
  }

  async muteUser(userId, targetUserId) {
    await this.User.findByIdAndUpdate(userId, { $addToSet: { mutedUsers: targetUserId } });
  }

  async searchUsers(query, excludeUserId) {
    if (!query || query.length < 2) throw new BadRequestError('Search query too short');

    const users = await this.User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: excludeUserId },
      isActive: true,
    })
      .select('username email avatarUrl bio status')
      .limit(20);

    return { users };
  }
}

module.exports = UserService;

