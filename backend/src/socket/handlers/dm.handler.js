const Room = require('../../models/Room');
const Message = require('../../models/Message');
const User = require('../../models/User');
const { SOCKET_EVENTS, ROOM_TYPES, ROOM_ROLES, MESSAGE_TYPES } = require('../../utils/constants');
const { createNotification } = require('../../services/notification.service');
const logger = require('../../utils/logger');

function registerDMHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.SEND_DM, async ({ targetUserId, content, attachments = [] }) => {
    try {
      if (targetUserId === socket.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot DM yourself' });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'User not found' });

      // Check if blocked
      if (targetUser.blockedUsers?.some((id) => id.toString() === socket.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'User has blocked you' });
      }

      // Find or create DM room
      let room = await Room.findOne({
        type: ROOM_TYPES.DM,
        'members.user': { $all: [socket.userId, targetUserId] },
        $expr: { $eq: [{ $size: '$members' }, 2] },
      });

      if (!room) {
        room = await Room.create({
          name: `dm_${String(socket.userId).slice(-8)}_${String(targetUserId).slice(-8)}`,
          type: ROOM_TYPES.DM,
          createdBy: socket.userId,
          members: [
            { user: socket.userId, role: ROOM_ROLES.MEMBER },
            { user: targetUserId, role: ROOM_ROLES.MEMBER },
          ],
        });
      }

      const message = await Message.create({
        roomId: room._id,
        senderId: socket.userId,
        content,
        attachments,
        type: attachments.length > 0 ? MESSAGE_TYPES.FILE : MESSAGE_TYPES.TEXT,
      });

      await message.populate('senderId', 'username avatarUrl');

      await Room.findByIdAndUpdate(room._id, {
        lastMessage: message._id,
        lastActivity: new Date(),
      });

      // Populate room members so clients can display usernames
      await room.populate('members.user', 'username avatarUrl status isOnline');

      // Join both sockets to this DM room
      socket.join(`room:${room._id}`);

      // Emit to both users
      io.to(`user:${socket.userId}`).emit(SOCKET_EVENTS.NEW_DM, {
        room,
        message,
      });
      io.to(`user:${targetUserId}`).emit(SOCKET_EVENTS.NEW_DM, {
        room,
        message,
      });

      // Notification
      await createNotification({
        userId: targetUserId,
        type: 'dm',
        title: `New message from ${socket.user.username}`,
        body: content?.substring(0, 100) || 'Sent a file',
        senderId: socket.userId,
        roomId: room._id,
        messageId: message._id,
      });

    } catch (error) {
      logger.error('SEND_DM error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send DM' });
    }
  });
}

module.exports = { registerDMHandlers };

