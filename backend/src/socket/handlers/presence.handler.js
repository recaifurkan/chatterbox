const User = require('../../models/User');
const Room = require('../../models/Room');
const { SOCKET_EVENTS, USER_STATUS, REDIS_KEYS } = require('../../utils/constants');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

function registerPresenceHandlers(io, socket) {
  const { presenceService } = require('../../container');
  // 1. Kişisel bildirim odasına katıl
  socket.join(`user:${socket.userId}`);

  // 2. Redis'te socket <-> user eşlemesini sakla
  const redis = getRedisClient();
  redis.setex(REDIS_KEYS.USER_SOCKET(socket.userId), 86400, socket.id).catch(() => {});

  // 3. Kullanıcıyı online işaretle + tüm odalarına yeniden katıl
  presenceService.setUserOnline(socket.userId, socket.id)
    .then(async () => {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        status: USER_STATUS.ONLINE,
        lastSeen: new Date(),
      });

      const rooms = await Room.find({ 'members.user': socket.userId, isActive: true });
      for (const room of rooms) {
        socket.join(`room:${room._id}`);
      }
      logger.info(`${socket.user.username} ${rooms.length} odaya (yeniden) katıldı [${process.env.INSTANCE_ID || 'default'}]`);

      io.emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
        userId: socket.userId,
        status: USER_STATUS.ONLINE,
        isOnline: true,
      });
    })
    .catch((err) => logger.error('Presence connect hatası:', err));

  // 4. Manuel durum değiştirme
  socket.on(SOCKET_EVENTS.SET_STATUS, async ({ status }) => {
    try {
      const validStatuses = Object.values(USER_STATUS).filter((s) => s !== USER_STATUS.OFFLINE);
      if (!validStatuses.includes(status)) return;

      await presenceService.setUserStatus(socket.userId, status);
      await User.findByIdAndUpdate(socket.userId, { status });

      io.emit(SOCKET_EVENTS.USER_STATUS_CHANGE, { userId: socket.userId, status });
    } catch (error) {
      logger.error('SET_STATUS hatası:', error);
    }
  });

  // 5. Bağlantı kopunca offline işaretle
  socket.on('disconnect', async () => {
    try {
      await new Promise((r) => setTimeout(r, 2000));

      const storedSocketId = await redis.get(REDIS_KEYS.USER_SOCKET(socket.userId));
      if (storedSocketId !== socket.id) return;

      await presenceService.setUserOffline(socket.userId);
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        status: USER_STATUS.OFFLINE,
        lastSeen: new Date(),
      });

      io.emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
        userId: socket.userId,
        status: USER_STATUS.OFFLINE,
        isOnline: false,
        lastSeen: new Date(),
      });
    } catch (error) {
      logger.error('Presence disconnect hatası:', error);
    }
  });
}

module.exports = { registerPresenceHandlers };

