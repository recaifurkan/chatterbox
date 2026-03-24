const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');
const logger = require('../utils/logger');

async function createNotification({ userId, type, title, body, payload = {}, senderId, roomId, messageId }) {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      body,
      payload,
      sender: senderId,
      roomId,
      messageId,
    });

    // Push real-time notification via socket
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('new_notification', {
        notification: notification.toObject(),
      });
    } catch (socketErr) {
      logger.warn('Could not emit notification socket event:', socketErr.message);
    }

    return notification;
  } catch (error) {
    logger.error('Failed to create notification:', error);
  }
}

async function createMentionNotifications(message, room) {
  if (!message.mentions || message.mentions.length === 0) return;

  for (const mentionedUserId of message.mentions) {
    if (mentionedUserId.toString() === message.senderId.toString()) continue;

    await createNotification({
      userId: mentionedUserId,
      type: 'mention',
      title: `You were mentioned in #${room.name}`,
      body: message.content?.substring(0, 100) || 'You were mentioned',
      senderId: message.senderId,
      roomId: room._id,
      messageId: message._id,
      payload: { roomId: room._id, messageId: message._id },
    });
  }
}

module.exports = { createNotification, createMentionNotifications };

