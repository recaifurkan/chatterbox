const Message = require('../../models/Message');
const { SOCKET_EVENTS } = require('../../utils/constants');
const logger = require('../../utils/logger');

function registerReadReceiptHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.MARK_READ, async ({ roomId, messageIds }) => {
    try {
      if (!messageIds || !messageIds.length) return;

      await Message.updateMany(
        {
          _id: { $in: messageIds },
          roomId,
          'readBy.user': { $ne: socket.userId },
        },
        {
          $push: { readBy: { user: socket.userId, readAt: new Date() } },
        }
      );

      // Notify the senders
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.MESSAGES_READ, {
        roomId,
        messageIds,
        readBy: {
          userId: socket.userId,
          username: socket.user.username,
          readAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('MARK_READ error:', error);
    }
  });
}

module.exports = { registerReadReceiptHandlers };

