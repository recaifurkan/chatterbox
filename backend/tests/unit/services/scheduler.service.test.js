/**
 * Unit tests for scheduler.service.js
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser, createRoom, createMessage } = require('../../helpers/setup');

let mockRedisClient;
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: () => mockRedisClient,
}));

const mockEmit = jest.fn();
jest.mock('../../../src/config/socket', () => ({
  getIO: () => ({ to: jest.fn(() => ({ emit: mockEmit })) }),
}));

// Mock node-cron so we can capture and trigger the scheduled function manually
let capturedCronCallback;
jest.mock('node-cron', () => ({
  schedule: jest.fn((pattern, callback) => {
    capturedCronCallback = callback;
  }),
}));

beforeAll(async () => {
  setTestEnv();
  const RedisMock = require('ioredis-mock');
  mockRedisClient = new RedisMock();
  await connectDB();
});
afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  await mockRedisClient.flushall();
  jest.clearAllMocks();
  capturedCronCallback = undefined;
});

describe('scheduler.service - startScheduler', () => {
  it('registers a cron job', () => {
    const cron = require('node-cron');
    const { startScheduler } = require('../../../src/services/scheduler.service');
    startScheduler();
    expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));
  });

  it('does nothing when lock is already held', async () => {
    const { startScheduler } = require('../../../src/services/scheduler.service');
    startScheduler();

    // Pre-set the lock
    await mockRedisClient.set('scheduler:lock', '1', 'EX', 55);

    await capturedCronCallback();

    // No messages should be processed (lock was held)
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('processes due scheduled messages and emits NEW_MESSAGE', async () => {
    const { startScheduler } = require('../../../src/services/scheduler.service');
    startScheduler();

    const user = await createUser();
    const room = await createRoom(user._id);

    // Create a scheduled message that is due (scheduledAt in the past)
    const pastDate = new Date(Date.now() - 60000);
    const msg = await createMessage(room._id, user._id, {
      content: 'Scheduled msg',
      isScheduled: true,
      scheduledAt: pastDate,
    });

    await capturedCronCallback();

    const Message = require('../../../src/models/Message');
    const updated = await Message.findById(msg._id);
    expect(updated.isScheduled).toBe(false);
    expect(mockEmit).toHaveBeenCalled();
  });

  it('releases lock in finally block even on error', async () => {
    const { startScheduler } = require('../../../src/services/scheduler.service');
    startScheduler();

    // Create a message that will cause a processing error (bad roomId type)
    const user = await createUser();
    const pastDate = new Date(Date.now() - 60000);
    // Create message with invalid roomId to cause an error when finding room
    const Message = require('../../../src/models/Message');
    await Message.create({
      roomId: new mongoose.Types.ObjectId(),
      senderId: user._id,
      content: 'error test',
      isScheduled: true,
      scheduledAt: pastDate,
    });

    // Should complete without throwing (error caught inside)
    await expect(capturedCronCallback()).resolves.not.toThrow();

    // Lock should be released after run
    const lock = await mockRedisClient.get('scheduler:lock');
    expect(lock).toBeNull();
  });

  it('skips messages for rooms that no longer exist', async () => {
    const { startScheduler } = require('../../../src/services/scheduler.service');
    startScheduler();

    const user = await createUser();
    const fakeRoomId = new mongoose.Types.ObjectId();
    const pastDate = new Date(Date.now() - 60000);
    await createMessage(fakeRoomId, user._id, {
      content: 'Orphan msg',
      isScheduled: true,
      scheduledAt: pastDate,
    });

    // Should not throw
    await capturedCronCallback();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

