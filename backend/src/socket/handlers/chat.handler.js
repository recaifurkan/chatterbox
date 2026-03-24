const Message = require('../../models/Message');
const Room = require('../../models/Room');
const User = require('../../models/User');
const { SOCKET_EVENTS, MESSAGE_TYPES, ROOM_TYPES, ROOM_ROLES } = require('../../utils/constants');
const { createMentionNotifications } = require('../../services/notification.service');
const logger = require('../../utils/logger');

function registerChatHandlers(io, socket) {
  // Join a room
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async ({ roomId }) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });

      if (room.type !== ROOM_TYPES.PUBLIC && !room.isMember(socket.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not a member of this room' });
      }

      socket.join(`room:${roomId}`);
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, { roomId });

      // Notify others
      socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.USER_JOINED_ROOM, {
        roomId,
        user: { _id: socket.user._id, username: socket.user.username, avatarUrl: socket.user.avatarUrl },
      });

      logger.info(`${socket.user.username} joined room ${roomId}`);
    } catch (error) {
      logger.error('JOIN_ROOM error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ roomId }) => {
    socket.leave(`room:${roomId}`);
    socket.emit(SOCKET_EVENTS.ROOM_LEFT, { roomId });
    socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.USER_LEFT_ROOM, {
      roomId,
      userId: socket.userId,
    });
  });

  // Send message
  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data) => {
    try {
      const { roomId, content, attachments = [], replyTo, type = MESSAGE_TYPES.TEXT, expiresIn } = data;

      const room = await Room.findById(roomId);
      if (!room || !room.isMember(socket.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot send message to this room' });
      }

      // Check if sender is blocked by recipient (for DM)
      if (room.type === ROOM_TYPES.DM) {
        const otherMember = room.members.find((m) => m.user.toString() !== socket.userId);
        if (otherMember) {
          const otherUser = await User.findById(otherMember.user);
          if (otherUser?.blockedUsers?.some((id) => id.toString() === socket.userId)) {
            return socket.emit(SOCKET_EVENTS.ERROR, { message: 'User has blocked you' });
          }
        }
      }

      // Extract mentions from content
      const mentionRegex = /@(\w+)/g;
      const mentionedUsernames = [...(content || '').matchAll(mentionRegex)].map((m) => m[1]);
      let mentions = [];
      if (mentionedUsernames.length) {
        const mentionedUsers = await User.find({ username: { $in: mentionedUsernames } }).select('_id');
        mentions = mentionedUsers.map((u) => u._id);
      }

      const messageData = {
        roomId,
        senderId: socket.userId,
        content,
        type: attachments.length > 0 ? (attachments[0].mimeType?.startsWith('image/') ? MESSAGE_TYPES.IMAGE : MESSAGE_TYPES.FILE) : type,
        attachments,
        mentions,
        replyTo: replyTo || null,
      };

      if (expiresIn) {
        messageData.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      const message = await Message.create(messageData);
      await message.populate('senderId', 'username avatarUrl');
      if (replyTo) await message.populate('replyTo', 'content senderId');

      // Update room last activity
      await Room.findByIdAndUpdate(roomId, {
        lastMessage: message._id,
        lastActivity: new Date(),
      });

      // Broadcast to room
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.NEW_MESSAGE, { message });

      // Handle mentions notifications
      if (mentions.length) {
        await createMentionNotifications(message, room);
      }

    } catch (error) {
      logger.error('SEND_MESSAGE error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
    }
  });

  // Edit message
  socket.on(SOCKET_EVENTS.EDIT_MESSAGE, async ({ messageId, content }) => {
    try {
      const message = await Message.findOne({ _id: messageId, senderId: socket.userId, isDeleted: false });
      if (!message) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Message not found' });

      message.editHistory.push({ content: message.content, editedBy: socket.userId });
      message.content = content;
      message.isEdited = true;
      await message.save();

      io.to(`room:${message.roomId}`).emit(SOCKET_EVENTS.MESSAGE_EDITED, {
        messageId,
        content,
        isEdited: true,
      });
    } catch (error) {
      logger.error('EDIT_MESSAGE error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to edit message' });
    }
  });

  // Delete message
  socket.on(SOCKET_EVENTS.DELETE_MESSAGE, async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Message not found' });

      const room = await Room.findById(message.roomId);
      const isOwner = message.senderId.toString() === socket.userId;
      const isAdmin = room?.hasRole(socket.userId, ['owner', 'admin', 'moderator']);

      if (!isOwner && !isAdmin) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Permission denied' });
      }

      message.isDeleted = true;
      message.content = 'This message has been deleted';
      message.deletedAt = new Date();
      message.deletedBy = socket.userId;
      await message.save();

      io.to(`room:${message.roomId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId });
    } catch (error) {
      logger.error('DELETE_MESSAGE error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to delete message' });
    }
  });
}

module.exports = { registerChatHandlers };

