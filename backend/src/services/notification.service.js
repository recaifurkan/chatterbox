const { SOCKET_EVENTS, USER_KEY } = require('../utils/constants');
const { NotFoundError } = require('../utils/AppError');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * @param {{ Notification: import('mongoose').Model, getIO: () => import('socket.io').Server }} deps
   */
  constructor({ Notification, getIO }) {
    this.Notification = Notification;
    this.getIO = getIO;
  }

  /**
   * Bildirim oluşturur ve socket üzerinden hedef kullanıcıya iletir.
   */
  async createNotification({ userId, type, title, body, payload = {}, senderId, roomId, messageId }) {
    const notification = await this.Notification.create({
      userId,
      type,
      title,
      body,
      payload,
      sender: senderId,
      roomId,
      messageId,
    });

    const io = this.getIO();
    const targetRoom = USER_KEY(userId.toString());
    io.to(targetRoom).emit(SOCKET_EVENTS.NEW_NOTIFICATION, {
      notification: {
        _id: notification._id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        read: false,
        payload: notification.payload,
        sender: notification.sender,
        roomId: notification.roomId,
        messageId: notification.messageId,
        createdAt: notification.createdAt,
      },
    });
    logger.info(`Notification emitted → ${targetRoom} | type:${type} | title:${title}`);

    return notification;
  }

  /**
   * Mention bildirimleri oluşturur.
   */
  async createMentionNotifications(message, room) {
    if (!message.mentions || message.mentions.length === 0) return;

    const senderIdClean = message.senderId?._id || message.senderId;

    for (const mentionedUserId of message.mentions) {
      if (mentionedUserId.toString() === senderIdClean.toString()) continue;

      await this.createNotification({
        userId: mentionedUserId,
        type: 'mention',
        title: `You were mentioned in #${room.name}`,
        body: message.content?.substring(0, 100) || 'You were mentioned',
        senderId: senderIdClean,
        roomId: room._id,
        messageId: message._id,
        payload: { roomId: room._id, messageId: message._id },
      });
    }
  }

  // ── CRUD (controller tarafından kullanılır) ─────────────────────────────

  async getNotifications(userId, { page = 1, limit = 20, unread } = {}) {
    const query = { userId };
    if (unread === 'true') query.read = false;

    const total = await this.Notification.countDocuments(query);
    const notifications = await this.Notification.find(query)
      .populate('sender', 'username avatarUrl')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const unreadCount = await this.Notification.countDocuments({ userId, read: false });

    return { notifications, unreadCount, total };
  }

  async markRead(notificationId, userId) {
    const notification = await this.Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) throw new NotFoundError('Notification not found');
    return notification;
  }

  async markAllRead(userId) {
    await this.Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );
  }

  async deleteNotification(notificationId, userId) {
    await this.Notification.findOneAndDelete({ _id: notificationId, userId });
  }
}

module.exports = NotificationService;
