const User = require('../../models/User');
const Room = require('../../models/Room');
const { SOCKET_EVENTS, USER_STATUS, REDIS_KEYS } = require('../../utils/constants');
const { setUserOnline, setUserOffline, setUserStatus } = require('../../services/presence.service');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

function registerPresenceHandlers(io, socket) {
  // Her bağlantıda (ilk bağlantı veya yeniden bağlantı) çalışır.
  // WebSocket transport + least_conn load balancing ile client farklı bir
  // node'a bağlanabilir. Bu handler o node'da gerekli tüm state'i kurar.

  // 1. Kişisel bildirim odasına katıl (DM, notification hedefleme)
  socket.join(`user:${socket.userId}`);

  // 2. Redis'te socket <-> user eşlemesini sakla
  const redis = getRedisClient();
  redis.setex(REDIS_KEYS.USER_SOCKET(socket.userId), 86400, socket.id).catch(() => {});

  // 3. Kullanıcıyı online işaretle + tüm odalarına bu node'da yeniden katıl
  setUserOnline(socket.userId, socket.id)
    .then(async () => {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        status: USER_STATUS.ONLINE,
        lastSeen: new Date(),
      });

      // Üye olduğu tüm aktif odalar — yeniden bağlanmada bile bu node'da
      // socket.io odalarına join edilmesi gerekir (Redis Adapter odaları node
      // bazında yönetir; bir node yeniden başladığında odaları sıfırlanır).
      const rooms = await Room.find({ 'members.user': socket.userId, isActive: true });
      for (const room of rooms) {
        socket.join(`room:${room._id}`);
      }
      logger.info(`${socket.user.username} ${rooms.length} odaya (yeniden) katıldı [${process.env.INSTANCE_ID || 'default'}]`);

      // Online durumunu tüm bağlı clientlara yayınla
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

      await setUserStatus(socket.userId, status);
      await User.findByIdAndUpdate(socket.userId, { status });

      io.emit(SOCKET_EVENTS.USER_STATUS_CHANGE, { userId: socket.userId, status });
    } catch (error) {
      logger.error('SET_STATUS hatası:', error);
    }
  });

  // 5. Bağlantı kopunca offline işaretle
  socket.on('disconnect', async () => {
    try {
      // Küçük bir bekleme: hızlı yeniden bağlanmada gereksiz offline bildirimi engelle
      await new Promise((r) => setTimeout(r, 2000));

      // Socket hâlâ bu socket.id ile kayıtlıysa (yani yeni bağlantı kurmadıysa) offline yap
      const storedSocketId = await redis.get(REDIS_KEYS.USER_SOCKET(socket.userId));
      if (storedSocketId !== socket.id) return; // Farklı bir node'a bağlandı — skip

      await setUserOffline(socket.userId);
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

