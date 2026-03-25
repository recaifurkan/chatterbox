const Message = require('../../models/Message');
const Room = require('../../models/Room');
const User = require('../../models/User');
const { SOCKET_EVENTS, MESSAGE_TYPES, ROOM_TYPES } = require('../../utils/constants');
const logger = require('../../utils/logger');

class ChatHandler {
  constructor({ notificationService, messageService }) {
    this.notificationService = notificationService;
    this.messageService = messageService;
  }

  register(io, socket) {
    const { notificationService, messageService } = this;

    socket.on(SOCKET_EVENTS.JOIN_ROOM, async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });

        if (room.type !== ROOM_TYPES.PUBLIC && !room.isMember(socket.userId)) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not a member of this room' });
        }

        socket.join(`room:${roomId}`);
        socket.emit(SOCKET_EVENTS.ROOM_JOINED, { roomId });

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

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      socket.emit(SOCKET_EVENTS.ROOM_LEFT, { roomId });
      socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.USER_LEFT_ROOM, {
        roomId,
        userId: socket.userId,
      });
    });

    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data) => {
      try {
        const { roomId, content, attachments = [], replyTo, type = MESSAGE_TYPES.TEXT, expiresIn } = data;

        const room = await Room.findById(roomId);
        if (!room || !room.isMember(socket.userId)) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot send message to this room' });
        }

        if (room.type === ROOM_TYPES.DM) {
          const otherMember = room.members.find((m) => m.user.toString() !== socket.userId);
          if (otherMember) {
            const otherUser = await User.findById(otherMember.user);
            if (otherUser?.blockedUsers?.some((id) => id.toString() === socket.userId)) {
              return socket.emit(SOCKET_EVENTS.ERROR, { message: 'User has blocked you' });
            }
          }
        }

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

        await Room.findByIdAndUpdate(roomId, {
          lastMessage: message._id,
          lastActivity: new Date(),
        });

        io.to(`room:${roomId}`).emit(SOCKET_EVENTS.NEW_MESSAGE, { message });

        if (mentions.length) {
          try {
            await notificationService.createMentionNotifications(message, room);
          } catch (mentionErr) {
            logger.error('Mention notification error:', mentionErr);
          }
        }

        try {
          if (room.type !== ROOM_TYPES.DM) {
            const mentionSet = new Set(mentions.map((m) => m.toString()));
            const socketRoom = io.sockets.adapter.rooms.get(`room:${roomId}`);

            for (const member of room.members) {
              const memberId = (member.user?._id || member.user).toString();
              if (memberId === socket.userId) continue;
              if (mentionSet.has(memberId)) continue;

              const memberSocketId = await io.in(`user:${memberId}`).allSockets();
              const isInRoom = memberSocketId.size > 0 && socketRoom &&
                [...memberSocketId].some((sid) => socketRoom.has(sid));
              if (isInRoom) continue;

              await notificationService.createNotification({
                userId: memberId,
                type: 'message',
                title: `${socket.user.username} in #${room.name}`,
                body: content?.substring(0, 100) || 'Sent a file',
                senderId: socket.userId,
                roomId: room._id,
                messageId: message._id,
                payload: { roomId: room._id, messageId: message._id },
              });
            }
          }
        } catch (roomNotifErr) {
          logger.error('Room notification error:', roomNotifErr);
        }

      } catch (error) {
        logger.error('SEND_MESSAGE error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
      }
    });

    socket.on(SOCKET_EVENTS.EDIT_MESSAGE, async ({ messageId, content }) => {
      try {
        const { message } = await messageService.editMessage(messageId, socket.userId, content);
        io.to(`room:${message.roomId}`).emit(SOCKET_EVENTS.MESSAGE_EDITED, {
          messageId,
          content,
          isEdited: true,
        });
      } catch (error) {
        logger.error('EDIT_MESSAGE error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Failed to edit message' });
      }
    });

    socket.on(SOCKET_EVENTS.DELETE_MESSAGE, async ({ messageId }) => {
      try {
        const result = await messageService.deleteMessage(messageId, socket.userId);
        io.to(`room:${result.roomId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId });
      } catch (error) {
        logger.error('DELETE_MESSAGE error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Failed to delete message' });
      }
    });
  }
}

module.exports = ChatHandler;

