const Message = require('../../models/Message');
const { SOCKET_EVENTS } = require('../../utils/constants');
const logger = require('../../utils/logger');

class ReactionHandler {
  constructor({ messageService }) {
    this.messageService = messageService;
  }

  register(io, socket) {
    const { messageService } = this;

    socket.on(SOCKET_EVENTS.ADD_REACTION, async ({ messageId, emoji }) => {
      try {
        const { reactions } = await messageService.addReaction(messageId, socket.userId, emoji);

        io.to(`room:${(await Message.findById(messageId)).roomId}`).emit(SOCKET_EVENTS.REACTION_UPDATED, {
          messageId,
          reactions,
        });
      } catch (error) {
        logger.error('ADD_REACTION error:', error);
      }
    });

    socket.on(SOCKET_EVENTS.REMOVE_REACTION, async ({ messageId, emoji }) => {
      try {
        const { reactions } = await messageService.removeReaction(messageId, socket.userId, emoji);

        io.to(`room:${(await Message.findById(messageId)).roomId}`).emit(SOCKET_EVENTS.REACTION_UPDATED, {
          messageId,
          reactions,
        });
      } catch (error) {
        logger.error('REMOVE_REACTION error:', error);
      }
    });
  }
}

module.exports = ReactionHandler;

