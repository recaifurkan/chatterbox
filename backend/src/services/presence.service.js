const { USER_STATUS, REDIS_KEYS } = require('../utils/constants');

class PresenceService {
  /**
   * @param {{ redisService: import('./redis.service') }} deps
   */
  constructor({ redisService }) {
    this.redisService = redisService;
  }

  async setUserOnline(userId, socketId) {
    await this.redisService.hset(REDIS_KEYS.USER_PRESENCE(userId), {
      status: USER_STATUS.ONLINE,
      socketId,
      lastSeen: Date.now(),
    });
    await this.redisService.expire(REDIS_KEYS.USER_PRESENCE(userId), 86400);
  }

  async setUserOffline(userId) {
    await this.redisService.hset(REDIS_KEYS.USER_PRESENCE(userId), {
      status: USER_STATUS.OFFLINE,
      socketId: '',
      lastSeen: Date.now(),
    });
    await this.redisService.expire(REDIS_KEYS.USER_PRESENCE(userId), 86400);
  }

  async setUserStatus(userId, status) {
    await this.redisService.hset(REDIS_KEYS.USER_PRESENCE(userId), { status });
  }

  async getUserPresence(userId) {
    const data = await this.redisService.hgetall(REDIS_KEYS.USER_PRESENCE(userId));
    if (!data || !data.status) return { status: USER_STATUS.OFFLINE, lastSeen: null };
    return {
      status: data.status,
      lastSeen: data.lastSeen ? new Date(parseInt(data.lastSeen)) : null,
      socketId: data.socketId,
    };
  }

  async getUsersPresence(userIds) {
    const pipeline = this.redisService.pipeline();
    userIds.forEach((id) => pipeline.hgetall(REDIS_KEYS.USER_PRESENCE(id)));
    const results = await pipeline.exec();
    return userIds.reduce((acc, id, idx) => {
      const data = results[idx][1];
      acc[id] = data?.status || USER_STATUS.OFFLINE;
      return acc;
    }, {});
  }

  async setTyping(roomId, userId, username, ttl = 5) {
    await this.redisService.setex(REDIS_KEYS.TYPING(roomId, userId), ttl, username);
  }

  async clearTyping(roomId, userId) {
    await this.redisService.del(REDIS_KEYS.TYPING(roomId, userId));
  }

  async getTypingUsers(roomId) {
    const pattern = `typing:${roomId}:*`;

    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, found] = await this.redisService.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    if (!keys.length) return [];

    const pipeline = this.redisService.pipeline();
    keys.forEach((k) => pipeline.get(k));
    const results = await pipeline.exec();

    return keys.map((k, i) => ({
      userId: k.split(':')[2],
      username: results[i][1],
    }));
  }
}

module.exports = PresenceService;

