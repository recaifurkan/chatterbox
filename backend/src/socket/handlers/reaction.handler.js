const Message = require('../../models/Message');
const { SOCKET_EVENTS } = require('../../utils/constants');
const logger = require('../../utils/logger');

function registerReactionHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.ADD_REACTION, async ({ messageId, emoji }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message || message.isDeleted) return;

      const existing = message.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.users.some((u) => u.toString() === socket.userId)) return;
        existing.users.push(socket.userId);
        existing.count += 1;
      } else {
        message.reactions.push({ emoji, users: [socket.userId], count: 1 });
      }

      await message.save();

      io.to(`room:${message.roomId}`).emit(SOCKET_EVENTS.REACTION_UPDATED, {
        messageId,
        reactions: message.reactions,
      });
    } catch (error) {
      logger.error('ADD_REACTION error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.REMOVE_REACTION, async ({ messageId, emoji }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const reaction = message.reactions.find((r) => r.emoji === emoji);
      if (reaction) {
        reaction.users = reaction.users.filter((u) => u.toString() !== socket.userId);
        reaction.count = reaction.users.length;
        if (reaction.count === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
      }

      await message.save();

      io.to(`room:${message.roomId}`).emit(SOCKET_EVENTS.REACTION_UPDATED, {
        messageId,
        reactions: message.reactions,
      });
    } catch (error) {
      logger.error('REMOVE_REACTION error:', error);
    }
  });
}

module.exports = { registerReactionHandlers };

