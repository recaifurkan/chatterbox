const cron = require('node-cron');
const { SOCKET_EVENTS } = require('../utils/constants');
const { BadRequestError, NotFoundError } = require('../utils/AppError');
const logger = require('../utils/logger');

const LOCK_KEY = 'scheduler:lock';
const LOCK_TTL = 55;

class SchedulerService {
  constructor({ Message, Room, redisService, getIO }) {
    this.Message = Message;
    this.Room = Room;
    this.redisService = redisService;
    this.getIO = getIO;
  }

  // ── CRUD (controller tarafından kullanılır) ─────────────────────────────

  async createScheduledMessage(userId, { roomId, content, attachments = [], scheduledAt }) {
    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      throw new BadRequestError('scheduledAt must be in the future');
    }

    if (!content && attachments.length === 0) {
      throw new BadRequestError('Message must have content or at least one attachment');
    }

    const room = await this.Room.findById(roomId);
    if (!room || !room.isMember(userId)) {
      throw new NotFoundError('Room not found or not a member');
    }

    const message = await this.Message.create({
      roomId,
      senderId: userId,
      content,
      attachments,
      isScheduled: true,
      scheduledAt: new Date(scheduledAt),
    });

    return { message };
  }

  async listScheduledMessages(userId) {
    const messages = await this.Message.find({
      senderId: userId,
      isScheduled: true,
      isDeleted: false,
    }).populate('roomId', 'name').sort({ scheduledAt: 1 });

    return { messages };
  }

  async cancelScheduledMessage(messageId, userId) {
    const message = await this.Message.findOne({
      _id: messageId,
      senderId: userId,
      isScheduled: true,
    });

    if (!message) throw new NotFoundError('Scheduled message not found');

    message.isDeleted = true;
    message.isScheduled = false;
    await message.save();
  }

  // ── Cron job ────────────────────────────────────────────────────────────

  startScheduler() {
    cron.schedule('* * * * *', async () => {
      const acquired = await this.redisService.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
      if (!acquired) return;

      try {
        const now = new Date();
        const dueMessages = await this.Message.find({
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

              const room = await this.Room.findById(message.roomId);
              if (!room) return;

              room.lastMessage = message._id;
              room.lastActivity = now;
              await room.save();

              const io = this.getIO();
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
        await this.redisService.del(LOCK_KEY);
      }
    });

    logger.info('✅ Message scheduler started');
  }
}

module.exports = SchedulerService;

