const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

class MessageService {
  constructor({ Message, Room, auditService }) {
    this.Message = Message;
    this.Room = Room;
    this.auditService = auditService;
  }

  /**
   * Bir odadaki mesajları sayfalanmış olarak döner.
   */
  async getMessages(roomId, { page = 1, limit = 50, before } = {}) {
    const query = { roomId, isDeleted: false, isScheduled: false };
    if (before) query.createdAt = { $lt: new Date(before) };

    const total = await this.Message.countDocuments(query);
    const messages = await this.Message.find(query)
      .populate('senderId', 'username avatarUrl')
      .populate('replyTo', 'content senderId')
      .populate('reactions.users', 'username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return { messages: messages.reverse(), total };
  }

  /**
   * Mesaj düzenler. Sadece gönderen düzenleyebilir.
   */
  async editMessage(messageId, userId, content, ipAddress) {
    const message = await this.Message.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundError('Message not found');

    if (message.senderId.toString() !== userId.toString()) {
      throw new ForbiddenError("Cannot edit others' messages");
    }

    await this.auditService.logAction({
      messageId: message._id,
      roomId: message.roomId,
      action: 'edit',
      actorId: userId,
      before: { content: message.content },
      after: { content },
      ipAddress,
    });

    message.editHistory.push({ content: message.content, editedBy: userId });
    message.content = content;
    message.isEdited = true;
    await message.save();

    await message.populate('senderId', 'username avatarUrl');
    return { message };
  }

  /**
   * Mesaj siler. Gönderen veya oda admini silebilir.
   */
  async deleteMessage(messageId, userId, ipAddress) {
    const message = await this.Message.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundError('Message not found');

    const room = await this.Room.findById(message.roomId);
    const isOwner = message.senderId.toString() === userId.toString();
    const isAdmin = room?.hasRole(userId, ['owner', 'admin', 'moderator']);

    if (!isOwner && !isAdmin) throw new ForbiddenError('Permission denied');

    await this.auditService.logAction({
      messageId: message._id,
      roomId: message.roomId,
      action: 'delete',
      actorId: userId,
      before: { content: message.content },
      ipAddress,
    });

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    message.content = 'This message has been deleted';
    await message.save();

    return { messageId: message._id, roomId: message.roomId };
  }

  /**
   * Mesajları okundu olarak işaretler.
   */
  async markRead(roomId, messageIds, userId) {
    await this.Message.updateMany(
      {
        _id: { $in: messageIds },
        roomId,
        'readBy.user': { $ne: userId },
      },
      {
        $push: { readBy: { user: userId, readAt: new Date() } },
      }
    );
  }

  /**
   * Mesaja emoji reaksiyonu ekler.
   */
  async addReaction(messageId, userId, emoji) {
    const message = await this.Message.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundError('Message not found');

    const existing = message.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.users.some((u) => u.toString() === userId.toString())) {
        throw new ConflictError('Already reacted');
      }
      existing.users.push(userId);
      existing.count += 1;
    } else {
      message.reactions.push({ emoji, users: [userId], count: 1 });
    }

    await message.save();
    return { reactions: message.reactions };
  }

  /**
   * Mesajdan emoji reaksiyonunu kaldırır.
   */
  async removeReaction(messageId, userId, emoji) {
    const message = await this.Message.findById(messageId);
    if (!message) throw new NotFoundError('Message not found');

    const reaction = message.reactions.find((r) => r.emoji === emoji);
    if (reaction) {
      reaction.users = reaction.users.filter((u) => u.toString() !== userId.toString());
      reaction.count = reaction.users.length;
      if (reaction.count === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    }

    await message.save();
    return { reactions: message.reactions };
  }

  /**
   * Mesajın audit logunu döner. Sadece oda üyeleri görebilir.
   */
  async getAuditLog(messageId, userId) {
    const message = await this.Message.findById(messageId);
    if (!message) throw new NotFoundError('Message not found');

    const room = await this.Room.findById(message.roomId);
    if (!room?.isMember(userId)) {
      throw new ForbiddenError('Access denied');
    }

    const logs = await this.auditService.getLogsForMessage(messageId);
    return { logs };
  }

  /**
   * Mesajlarda arama yapar.
   */
  async searchMessages({ q, roomId, userId, startDate, endDate, page = 1, limit = 20 } = {}) {
    const query = { isDeleted: false, isScheduled: false };

    if (q) query.$text = { $search: q };
    if (roomId) query.roomId = roomId;
    if (userId) query.senderId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await this.Message.countDocuments(query);
    const messages = await this.Message.find(query)
      .populate('senderId', 'username avatarUrl')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return { messages, total };
  }
}

module.exports = MessageService;


