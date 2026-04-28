const { v4: uuidv4 } = require('uuid');
const { SOCKET_EVENTS, REDIS_KEYS, USER_KEY } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Call Signaling Handler (LiveKit entegrasyonu)
 *
 * Socket.IO yalnızca arama başlatma/kabul/reddetme/sonlandırma sinyallerini
 * taşır. Medya iletimi tamamen LiveKit sunucusu üzerinden yapılır.
 *
 * Akış:
 *  1. Caller → CALL_INITIATE → Server → Redis'e kaydet → CALL_INCOMING → Target
 *  2. Target → CALL_ACCEPT   → Server → LiveKit token üret (her iki taraf için)
 *                             → CALL_ACCEPT event'i her iki tarafa (livekitToken + url ile)
 *  3. Her iki taraf LiveKit sunucusuna bağlanır (WebRTC, SFU)
 *  4. Either → CALL_END      → Server → temizle → diğer tarafa bildir
 */
class CallHandler {
  constructor({ redisService, livekitService }) {
    this.redisService = redisService;
    this.livekitService = livekitService;
  }

  register(io, socket) {
    const redis = this.redisService;
    const livekit = this.livekitService;

    // ── Arama başlat ─────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CALL_INITIATE, async (data) => {
      try {
        const { roomId, targetUserId, callType = 'audio' } = data;
        if (!targetUserId) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'targetUserId is required' });
        }

        // Hedef kullanıcı zaten aramada mı?
        const targetBusy = await redis.get(REDIS_KEYS.CALL_USER(targetUserId));
        if (targetBusy) {
          return socket.emit(SOCKET_EVENTS.CALL_BUSY, {
            targetUserId,
            message: 'User is already in a call',
          });
        }

        // Arayan zaten aramada mı?
        const callerBusy = await redis.get(REDIS_KEYS.CALL_USER(socket.userId));
        if (callerBusy) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'You are already in a call' });
        }

        const callId = uuidv4();

        // Redis'e arama durumunu kaydet (5 dk TTL — cevapsız aramalar için temizlik)
        const callData = JSON.stringify({
          callId,
          roomId,
          callType,
          callerId: socket.userId,
          callerName: socket.user.username,
          callerAvatar: socket.user.avatarUrl,
          targetUserId,
          status: 'ringing',
          createdAt: Date.now(),
        });

        await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 300, callData);
        await redis.setex(REDIS_KEYS.CALL_USER(socket.userId), 300, callId);
        await redis.setex(REDIS_KEYS.CALL_USER(targetUserId), 300, callId);

        // Hedef kullanıcıya gelen arama bildirimi
        io.to(USER_KEY(targetUserId)).emit(SOCKET_EVENTS.CALL_INCOMING, {
          callId,
          roomId,
          callType,
          callerId: socket.userId,
          callerName: socket.user.username,
          callerAvatar: socket.user.avatarUrl,
        });

        // Arayana onay
        socket.emit(SOCKET_EVENTS.CALL_INITIATE, { callId, roomId, callType, targetUserId });

        logger.info(`📞 Call initiated: ${socket.user.username} → ${targetUserId} (${callType}) [${callId}]`);
      } catch (error) {
        logger.error('CALL_INITIATE error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to initiate call' });
      }
    });

    // ── Aramayı kabul et — LiveKit server seç + token üret ─────────────
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, async (data) => {
      try {
        const { callId } = data;
        const raw = await redis.get(REDIS_KEYS.CALL_ACTIVE(callId));
        if (!raw) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Call not found or expired' });
        }

        const callData = JSON.parse(raw);
        callData.status = 'connected';

        // ── Round-robin ile LiveKit server seç ──────────────────────────
        // Aynı serverId her iki kullanıcıya gönderilir → ikisi de aynı
        // LiveKit SFU'ya bağlanır (Nginx path-based routing ile).
        const serverId = livekit.pickServer();
        callData.livekitServerId = serverId;

        // Arama kabul edilince TTL'i 4 saate uzat
        await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 14400, JSON.stringify(callData));
        await redis.setex(REDIS_KEYS.CALL_USER(callData.callerId), 14400, callId);
        await redis.setex(REDIS_KEYS.CALL_USER(callData.targetUserId), 14400, callId);

        // LiveKit oda ismi = callId
        const livekitRoom = `call-${callId}`;

        // Arayan için token
        const callerToken = await livekit.generateToken(
          callData.callerId,
          callData.callerName,
          livekitRoom,
        );

        // Aranan için token
        const calleeToken = await livekit.generateToken(
          socket.userId,
          socket.user.username,
          livekitRoom,
        );

        // Arayana bildir (serverId gönder — client kendi host'una göre URL oluşturur)
        io.to(USER_KEY(callData.callerId)).emit(SOCKET_EVENTS.CALL_ACCEPT, {
          callId,
          userId: socket.userId,
          username: socket.user.username,
          livekitServerId: serverId,
          livekitToken: callerToken,
        });

        // Aranan tarafa bildir (aynı serverId → aynı LiveKit instance)
        socket.emit(SOCKET_EVENTS.CALL_ACCEPT, {
          callId,
          userId: callData.callerId,
          username: callData.callerName,
          livekitServerId: serverId,
          livekitToken: calleeToken,
        });

        logger.info(`📞 Call accepted: ${socket.user.username} [${callId}] — LiveKit server #${serverId}, room: ${livekitRoom}`);
      } catch (error) {
        logger.error('CALL_ACCEPT error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to accept call' });
      }
    });

    // ── Aramayı reddet ───────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CALL_REJECT, async (data) => {
      try {
        const { callId } = data;
        const raw = await redis.get(REDIS_KEYS.CALL_ACTIVE(callId));
        if (!raw) return;

        const callData = JSON.parse(raw);

        // Temizle
        await redis.del(REDIS_KEYS.CALL_ACTIVE(callId));
        await redis.del(REDIS_KEYS.CALL_USER(callData.callerId));
        await redis.del(REDIS_KEYS.CALL_USER(callData.targetUserId));

        // Arayana bildir
        io.to(USER_KEY(callData.callerId)).emit(SOCKET_EVENTS.CALL_REJECT, {
          callId,
          userId: socket.userId,
        });

        logger.info(`📞 Call rejected: ${socket.user.username} [${callId}]`);
      } catch (error) {
        logger.error('CALL_REJECT error:', error);
      }
    });

    // ── Aramayı sonlandır ────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CALL_END, async (data) => {
      try {
        const { callId } = data;
        const raw = await redis.get(REDIS_KEYS.CALL_ACTIVE(callId));
        if (!raw) return;

        const callData = JSON.parse(raw);

        // Temizle
        await redis.del(REDIS_KEYS.CALL_ACTIVE(callId));
        await redis.del(REDIS_KEYS.CALL_USER(callData.callerId));
        await redis.del(REDIS_KEYS.CALL_USER(callData.targetUserId));

        // Diğer katılımcılara bildir
        const otherUserId =
          callData.callerId === socket.userId ? callData.targetUserId : callData.callerId;

        io.to(USER_KEY(otherUserId)).emit(SOCKET_EVENTS.CALL_END, {
          callId,
          endedBy: socket.userId,
        });

        logger.info(`📞 Call ended by ${socket.user.username} [${callId}]`);
      } catch (error) {
        logger.error('CALL_END error:', error);
      }
    });

    // ── Disconnect — aktif arama varsa sonlandır ─────────────────────────
    socket.on('disconnect', async () => {
      try {
        const callId = await redis.get(REDIS_KEYS.CALL_USER(socket.userId));
        if (!callId) return;

        const raw = await redis.get(REDIS_KEYS.CALL_ACTIVE(callId));
        if (!raw) {
          await redis.del(REDIS_KEYS.CALL_USER(socket.userId));
          return;
        }

        const callData = JSON.parse(raw);

        // Temizle
        await redis.del(REDIS_KEYS.CALL_ACTIVE(callId));
        await redis.del(REDIS_KEYS.CALL_USER(callData.callerId));
        await redis.del(REDIS_KEYS.CALL_USER(callData.targetUserId));

        const otherUserId =
          callData.callerId === socket.userId ? callData.targetUserId : callData.callerId;

        io.to(USER_KEY(otherUserId)).emit(SOCKET_EVENTS.CALL_END, {
          callId,
          endedBy: socket.userId,
          reason: 'disconnected',
        });

        logger.info(`📞 Call ended (disconnect): ${socket.user.username} [${callId}]`);
      } catch (error) {
        logger.error('Call disconnect cleanup error:', error);
      }
    });
  }
}

module.exports = CallHandler;

