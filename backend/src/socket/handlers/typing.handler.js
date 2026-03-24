const { SOCKET_EVENTS } = require('../../utils/constants');
const { setTyping, clearTyping } = require('../../services/presence.service');

function registerTypingHandlers(io, socket) {
  const typingTimeouts = new Map();

  socket.on(SOCKET_EVENTS.TYPING_START, async ({ roomId }) => {
    await setTyping(roomId, socket.userId, socket.user.username);
    socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.USER_TYPING, {
      userId: socket.userId,
      username: socket.user.username,
      roomId,
    });

    // Auto-clear typing after 5s
    const key = `${roomId}:${socket.userId}`;
    if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key));
    typingTimeouts.set(
      key,
      setTimeout(async () => {
        await clearTyping(roomId, socket.userId);
        socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
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
    await clearTyping(roomId, socket.userId);
    socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
      userId: socket.userId,
      roomId,
    });
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    typingTimeouts.clear();
  });
}

module.exports = { registerTypingHandlers };

