/**
 * LiveKit Service — Multi-server support
 *
 * N adet LiveKit sunucusunu yönetir. Arama başladığında round-robin ile
 * bir sunucu seçer ve client'a serverId döndürür.
 * Client kendi host bilgisine göre WebSocket URL'ini oluşturur.
 *
 * Akış:
 *   1. CALL_ACCEPT → pickServer() → serverId (1..N)
 *   2. generateToken(userId, username, roomName)
 *   3. Client'a serverId + token gönderilir
 *   4. Client: ws[s]://<currentHost>/livekit/<serverId> URL'ini oluşturur
 *   5. Nginx /livekit/<serverId>/ → livekit<serverId>:7880
 */
const { AccessToken } = require('livekit-server-sdk');
const logger = require('../utils/logger');

class LiveKitService {
  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || 'devsecret';

    // Kaç LiveKit server var (docker-compose'daki livekit1..N)
    this.serverCount = parseInt(process.env.LIVEKIT_SERVER_COUNT, 10) || 2;

    // Round-robin sayacı
    this._rrIndex = 0;

    logger.info(
      `🎬 LiveKit Service: ${this.serverCount} server(s) — client builds URL from own host`
    );
  }

  /**
   * Round-robin ile bir LiveKit server seç
   * @returns {number} serverId (1-based)
   */
  pickServer() {
    this._rrIndex = (this._rrIndex % this.serverCount) + 1;
    return this._rrIndex;
  }

  /**
   * Belirtilen kullanıcı ve oda için LiveKit access token üret.
   *
   * @param {string} userId   – Kullanıcı MongoDB _id
   * @param {string} username – Görünen ad
   * @param {string} roomName – LiveKit oda ismi (genellikle callId)
   * @param {object} [grants] – Ek yetkiler
   * @returns {Promise<string>} JWT token
   */
  async generateToken(userId, username, roomName, grants = {}) {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: username,
      ttl: '4h',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      ...grants,
    });

    const token = await at.toJwt();
    logger.info(`🎬 LiveKit token: ${username} → room ${roomName}`);
    return token;
  }

}

module.exports = LiveKitService;
