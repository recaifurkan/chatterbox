const Redis = require('ioredis');
const logger = require('../utils/logger');

let pubClient = null;
let subClient = null;

async function connectRedis() {
  const redisOptions = {
    lazyConnect: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 2000);
      logger.info(`Redis retry attempt ${times}, delay ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
  };

  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is not defined');

  pubClient = new Redis(url, redisOptions);
  subClient = pubClient.duplicate();

  pubClient.on('error', (err) => logger.error('Redis pub error:', err));
  pubClient.on('connect', () => logger.info('✅ Redis pub connected'));
  subClient.on('error', (err) => logger.error('Redis sub error:', err));
  subClient.on('connect', () => logger.info('✅ Redis sub connected'));

  await pubClient.connect();
  await subClient.connect();

  logger.info('✅ Redis connected successfully');
}

function getRedisClient() {
  if (!pubClient) throw new Error('Redis not initialized');
  return pubClient;
}

function getRedisPubSub() {
  return { pubClient, subClient };
}

module.exports = { connectRedis, getRedisClient, getRedisPubSub };

