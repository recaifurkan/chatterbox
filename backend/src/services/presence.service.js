const { getRedisClient } = require('../config/redis');
const { REDIS_KEYS, USER_STATUS } = require('../utils/constants');

async function setUserOnline(userId, socketId) {
  const redis = getRedisClient();
  await redis.hset(REDIS_KEYS.USER_PRESENCE(userId), {
    status: USER_STATUS.ONLINE,
    socketId,
    lastSeen: Date.now(),
  });
  await redis.expire(REDIS_KEYS.USER_PRESENCE(userId), 86400); // 24h TTL
}

async function setUserOffline(userId) {
  const redis = getRedisClient();
  await redis.hset(REDIS_KEYS.USER_PRESENCE(userId), {
    status: USER_STATUS.OFFLINE,
    socketId: '',
    lastSeen: Date.now(),
  });
  await redis.expire(REDIS_KEYS.USER_PRESENCE(userId), 86400);
}

async function setUserStatus(userId, status) {
  const redis = getRedisClient();
  await redis.hset(REDIS_KEYS.USER_PRESENCE(userId), { status });
}

async function getUserPresence(userId) {
  const redis = getRedisClient();
  const data = await redis.hgetall(REDIS_KEYS.USER_PRESENCE(userId));
  if (!data || !data.status) return { status: USER_STATUS.OFFLINE, lastSeen: null };
  return {
    status: data.status,
    lastSeen: data.lastSeen ? new Date(parseInt(data.lastSeen)) : null,
    socketId: data.socketId,
  };
}

async function getUsersPresence(userIds) {
  const redis = getRedisClient();
  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.hgetall(REDIS_KEYS.USER_PRESENCE(id)));
  const results = await pipeline.exec();
  return userIds.reduce((acc, id, idx) => {
    const data = results[idx][1];
    acc[id] = data?.status || USER_STATUS.OFFLINE;
    return acc;
  }, {});
}

async function setTyping(roomId, userId, username, ttl = 5) {
  const redis = getRedisClient();
  await redis.setex(REDIS_KEYS.TYPING(roomId, userId), ttl, username);
}

async function clearTyping(roomId, userId) {
  const redis = getRedisClient();
  await redis.del(REDIS_KEYS.TYPING(roomId, userId));
}

async function getTypingUsers(roomId) {
  const redis = getRedisClient();
  const pattern = `typing:${roomId}:*`;

  // Use SCAN instead of KEYS to avoid blocking the Redis event loop
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, found] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...found);
  } while (cursor !== '0');

  if (!keys.length) return [];

  const pipeline = redis.pipeline();
  keys.forEach((k) => pipeline.get(k));
  const results = await pipeline.exec();

  return keys.map((k, i) => ({
    userId: k.split(':')[2],
    username: results[i][1],
  }));
}

module.exports = {
  setUserOnline,
  setUserOffline,
  setUserStatus,
  getUserPresence,
  getUsersPresence,
  setTyping,
  clearTyping,
  getTypingUsers,
};

