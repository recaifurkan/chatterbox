const { SOCKET_EVENTS, ROOM_KEY } = require('../../utils/constants');
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

        logger.info(`MARK_READ from ${socket.user.username}: room=${roomId}, msgs=${messageIds.length}`);

        await messageService.markRead(roomId, messageIds, socket.userId);

        io.to(ROOM_KEY(roomId)).emit(SOCKET_EVENTS.MESSAGES_READ, {
          roomId,
          messageIds,
          readBy: {
            user: socket.userId,
            username: socket.user.username,
            readAt: new Date(),
          },
        });

        logger.info(`MESSAGES_READ emitted to room:${roomId}`);
      } catch (error) {
        logger.error('MARK_READ error:', error);
      }
    });
  }
}

module.exports = ReadReceiptHandler;
