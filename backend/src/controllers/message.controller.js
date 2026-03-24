const Message = require('../models/Message');
const Room = require('../models/Room');
const AuditLog = require('../models/AuditLog');
const { successResponse, paginationMeta } = require('../utils/apiResponse');
const { createMentionNotifications } = require('../services/notification.service');
const { MESSAGE_TYPES } = require('../utils/constants');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

async function getMessages(req, res, next) {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50, before } = req.query;

    const query = { roomId, isDeleted: false, isScheduled: false };
    if (before) query.createdAt = { $lt: new Date(before) };

    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .populate('senderId', 'username avatarUrl')
      .populate('replyTo', 'content senderId')
      .populate('reactions.users', 'username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return successResponse(
      res,
      { messages: messages.reverse() },
      'Messages fetched',
      200,
      paginationMeta(total, page, limit)
    );
  } catch (error) {
    next(error);
  }
}

async function editMessage(req, res, next) {
  try {
    const message = await Message.findById(req.params.id);
    if (!message || message.isDeleted) throw new NotFoundError('Message not found');

    if (message.senderId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError("Cannot edit others' messages");
    }

    // Audit log
    await AuditLog.create({
      messageId: message._id,
      roomId: message.roomId,
      action: 'edit',
      actorId: req.user._id,
      before: { content: message.content },
      after: { content: req.body.content },
      ipAddress: req.ip,
    });

    message.editHistory.push({ content: message.content, editedBy: req.user._id });
    message.content = req.body.content;
    message.isEdited = true;
    await message.save();

    await message.populate('senderId', 'username avatarUrl');
    return successResponse(res, { message }, 'Message edited');
  } catch (error) {
    next(error);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const message = await Message.findById(req.params.id);
    if (!message || message.isDeleted) throw new NotFoundError('Message not found');

    const room = await Room.findById(message.roomId);
    const isOwner = message.senderId.toString() === req.user._id.toString();
    const isAdmin = room?.hasRole(req.user._id, ['owner', 'admin', 'moderator']);

    if (!isOwner && !isAdmin) throw new ForbiddenError('Permission denied');

    await AuditLog.create({
      messageId: message._id,
      roomId: message.roomId,
      action: 'delete',
      actorId: req.user._id,
      before: { content: message.content },
      ipAddress: req.ip,
    });

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = req.user._id;
    message.content = 'This message has been deleted';
    await message.save();

    return successResponse(res, { messageId: message._id }, 'Message deleted');
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const { roomId } = req.params;
    const { messageIds } = req.body;

    await Message.updateMany(
      {
        _id: { $in: messageIds },
        roomId,
        'readBy.user': { $ne: req.user._id },
      },
      {
        $push: { readBy: { user: req.user._id, readAt: new Date() } },
      }
    );

    return successResponse(res, null, 'Marked as read');
  } catch (error) {
    next(error);
  }
}

async function addReaction(req, res, next) {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundError('Message not found');

    const existing = message.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.users.some((u) => u.toString() === req.user._id.toString())) {
        throw new ConflictError('Already reacted');
      }
      existing.users.push(req.user._id);
      existing.count += 1;
    } else {
      message.reactions.push({ emoji, users: [req.user._id], count: 1 });
    }

    await message.save();
    return successResponse(res, { reactions: message.reactions }, 'Reaction added');
  } catch (error) {
    next(error);
  }
}

async function removeReaction(req, res, next) {
  try {
    const { id: messageId, emoji } = req.params;

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError('Message not found');

    const reaction = message.reactions.find((r) => r.emoji === decodeURIComponent(emoji));
    if (reaction) {
      reaction.users = reaction.users.filter((u) => u.toString() !== req.user._id.toString());
      reaction.count = reaction.users.length;
      if (reaction.count === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== decodeURIComponent(emoji));
      }
    }

    await message.save();
    return successResponse(res, { reactions: message.reactions }, 'Reaction removed');
  } catch (error) {
    next(error);
  }
}

async function getAuditLog(req, res, next) {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError('Message not found');

    const room = await Room.findById(message.roomId);
    if (!room || !room.isMember(req.user._id)) {
      throw new ForbiddenError('Access denied');
    }

    const logs = await AuditLog.find({ messageId })
      .populate('actorId', 'username')
      .sort({ createdAt: -1 });

    return successResponse(res, { logs });
  } catch (error) {
    next(error);
  }
}

async function searchMessages(req, res, next) {
  try {
    const { q, roomId, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = { isDeleted: false, isScheduled: false };

    if (q) query.$text = { $search: q };
    if (roomId) query.roomId = roomId;
    if (userId) query.senderId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .populate('senderId', 'username avatarUrl')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return successResponse(res, { messages }, 'Search results', 200, paginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMessages,
  editMessage,
  deleteMessage,
  markRead,
  addReaction,
  removeReaction,
  getAuditLog,
  searchMessages,
};
