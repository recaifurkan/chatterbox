const { SOCKET_EVENTS } = require('../../utils/constants');
const logger = require('../../utils/logger');

class ReadReceiptHandler {
  constructor({ messageService }) {
    this.messageService = messageService;
  }

  register(io, socket) {
    const { messageService } = this;

    socket.on(SOCKET_EVENTS.MARK_READ, async ({ roomId, messageIds }) => {
      try {
        if (!messageIds || !messageIds.length) return;

        await messageService.markRead(roomId, messageIds, socket.userId);

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
}

module.exports = ReadReceiptHandler;

