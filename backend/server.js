require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { initializeSocket } = require('./src/config/socket');
const { initMinIO } = require('./src/config/minio');
const {
  schedulerService,
  chatHandler, dmHandler, presenceHandler,
  reactionHandler, readReceiptHandler, typingHandler,
} = require('./src/container');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;
const INSTANCE_ID = process.env.INSTANCE_ID || 'default';

async function startServer() {
  try {
    logger.info(`🔧 Instance: ${INSTANCE_ID}`);
    await connectDB();
    await connectRedis();
    await initMinIO();

    const server = http.createServer(app);
    initializeSocket(server, {
      chatHandler, dmHandler, presenceHandler,
      reactionHandler, readReceiptHandler, typingHandler,
    });
    schedulerService.startScheduler();

    server.listen(PORT, () => {
      logger.info(`🚀 [${INSTANCE_ID}] Server running on port ${PORT} (${process.env.NODE_ENV})`);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

