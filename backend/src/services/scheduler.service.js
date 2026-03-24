const cron = require('node-cron');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { getRedisClient } = require('../config/redis');
const { getIO } = require('../config/socket');
const { SOCKET_EVENTS } = require('../utils/constants');
const logger = require('../utils/logger');

const LOCK_KEY = 'scheduler:lock';
const LOCK_TTL = 55; // seconds

function startScheduler() {
  cron.schedule('* * * * *', async () => {
    const redis = getRedisClient();

    // Distributed lock to prevent duplicate execution in multi-server setup
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    if (!acquired) return;

    try {
      const now = new Date();
      const dueMessages = await Message.find({
        isScheduled: true,
        scheduledAt: { $lte: now },
        isDeleted: false,
      }).populate('senderId', 'username avatarUrl');

      await Promise.all(
        dueMessages.map(async (message) => {
          try {
            message.isScheduled = false;
            message.scheduledAt = null;
            await message.save();

            const room = await Room.findById(message.roomId);
            if (!room) return;

            // Update room last activity
            room.lastMessage = message._id;
            room.lastActivity = now;
            await room.save();

            // Broadcast to room
            const io = getIO();
            io.to(`room:${message.roomId}`).emit(SOCKET_EVENTS.NEW_MESSAGE, {
              message: message.toObject(),
            });

            logger.info(`Scheduled message ${message._id} sent to room ${message.roomId}`);
          } catch (msgError) {
            logger.error(`Failed to process scheduled message ${message._id}:`, msgError);
          }
        })
      );
    } catch (error) {
      logger.error('Scheduler error:', error);
    } finally {
      // Always release the lock so next minute's run isn't blocked on error
      await redis.del(LOCK_KEY);
    }
  });

  logger.info('✅ Message scheduler started');
}

module.exports = { startScheduler };

