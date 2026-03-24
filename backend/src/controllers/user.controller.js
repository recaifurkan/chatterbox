const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const User = require('../models/User');
const { successResponse } = require('../utils/apiResponse');
const { getUserPresence } = require('../services/presence.service');
const { uploadBuffer, deleteObject, extractObjectName } = require('../config/minio');
const { getIO } = require('../config/socket');
const { SOCKET_EVENTS } = require('../utils/constants');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

async function getProfile(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password -blockedUsers -mutedUsers');
    if (!user) throw new NotFoundError('User not found');

    const presence = await getUserPresence(userId);
    return successResponse(res, { user: { ...user.toPublicJSON(), ...presence } });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { username, bio, statusMessage } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (statusMessage !== undefined) updates.statusMessage = statusMessage;

    if (username) {
      const existing = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existing) throw new ConflictError('Username already taken');
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return successResponse(res, { user: user.toPublicJSON() }, 'Profile updated');
  } catch (error) {
    next(error);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) throw new BadRequestError('Dosya bulunamadı');

    let jpegBuffer;
    try {
      jpegBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize(256, 256, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    } catch (sharpErr) {
      throw new BadRequestError('Resim formatı desteklenmiyor. Lütfen JPEG, PNG, WebP veya HEIC kullanın.');
    }

    // Eski avatarı MinIO'dan sil
    const oldUser = await User.findById(req.user._id);
    if (oldUser.avatarUrl) {
      const oldObjectName = extractObjectName(oldUser.avatarUrl);
      if (oldObjectName) await deleteObject(oldObjectName);
    }

    const objectName = `avatars/${req.user._id}_${uuidv4()}.jpg`;
    const avatarUrl = await uploadBuffer(objectName, jpegBuffer, 'image/jpeg');

    const user = await User.findByIdAndUpdate(req.user._id, { avatarUrl }, { new: true });
    return successResponse(res, { avatarUrl: user.avatarUrl }, 'Avatar güncellendi');
  } catch (error) {
    next(error);
  }
}

async function setStatus(req, res, next) {
  try {
    const { status, statusMessage } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (statusMessage !== undefined) updates.statusMessage = statusMessage;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });

    const io = getIO();
    io.emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
      userId: user._id,
      status: user.status,
      statusMessage: user.statusMessage,
    });

    return successResponse(res, { status: user.status, statusMessage: user.statusMessage }, 'Status updated');
  } catch (error) {
    next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) throw new BadRequestError('Cannot block yourself');

    const target = await User.findById(userId);
    if (!target) throw new NotFoundError('User not found');

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: userId } });
    return successResponse(res, null, 'User blocked');
  } catch (error) {
    next(error);
  }
}

async function unblockUser(req, res, next) {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: userId } });
    return successResponse(res, null, 'User unblocked');
  } catch (error) {
    next(error);
  }
}

async function muteUser(req, res, next) {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { mutedUsers: userId } });
    return successResponse(res, null, 'User muted');
  } catch (error) {
    next(error);
  }
}

async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) throw new BadRequestError('Search query too short');

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: req.user._id },
      isActive: true,
    })
      .select('username email avatarUrl bio status')
      .limit(20);

    return successResponse(res, { users });
  } catch (error) {
    next(error);
  }
}

module.exports = { getProfile, updateProfile, uploadAvatar, setStatus, blockUser, unblockUser, muteUser, searchUsers };

