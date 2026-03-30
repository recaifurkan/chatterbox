const { SOCKET_EVENTS, ROOM_KEY } = require('../../utils/constants');

class TypingHandler {
  constructor({ presenceService }) {
    this.presenceService = presenceService;
  }

  register(io, socket) {
    const { presenceService } = this;
    const typingTimeouts = new Map();

    socket.on(SOCKET_EVENTS.TYPING_START, async ({ roomId }) => {
      await presenceService.setTyping(roomId, socket.userId, socket.user.username);
      socket.to(ROOM_KEY(roomId)).emit(SOCKET_EVENTS.USER_TYPING, {
        userId: socket.userId,
        username: socket.user.username,
        roomId,
      });

      const key = `${roomId}:${socket.userId}`;
      if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key));
      typingTimeouts.set(
        key,
        setTimeout(async () => {
          await presenceService.clearTyping(roomId, socket.userId);
          socket.to(ROOM_KEY(roomId)).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
            userId: socket.userId,
            roomId,
          });
          typingTimeouts.delete(key);
        }, 5000)
      );
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, async ({ roomId }) => {
      const key = `${roomId}:${socket.userId}`;
      if (typingTimeouts.has(key)) {
        clearTimeout(typingTimeouts.get(key));
        typingTimeouts.delete(key);
      }
      await presenceService.clearTyping(roomId, socket.userId);
      socket.to(ROOM_KEY(roomId)).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
        userId: socket.userId,
        roomId,
      });
    });

    socket.on('disconnect', () => {
      typingTimeouts.forEach((timeout) => clearTimeout(timeout));
      typingTimeouts.clear();
    });
  }
}

module.exports = TypingHandler;
