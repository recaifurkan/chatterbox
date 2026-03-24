const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

async function connectDB(retries = MAX_RETRIES) {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    if (retries > 0) {
      logger.info(`Retrying in ${RETRY_DELAY / 1000}s... (${retries} attempts left)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return connectDB(retries - 1);
    }
    throw error;
  }
}

module.exports = { connectDB };

