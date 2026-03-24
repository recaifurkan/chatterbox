/**
 * Unit tests for notification.service.js
 */
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser } = require('../../helpers/setup');

// Mock socket.io
const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
jest.mock('../../../src/config/socket', () => ({
  getIO: () => ({ to: mockTo }),
}));

const Notification = require('../../../src/models/Notification');
const { createNotification, createMentionNotifications } = require('../../../src/services/notification.service');

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});

afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
});

describe('notification.service', () => {
  describe('createNotification', () => {
    it('persists a notification to DB', async () => {
      const user = await createUser();
      const sender = await createUser();

      const notification = await createNotification({
        userId: user._id,
        type: 'mention',
        title: 'You were mentioned',
        body: 'hello @user',
        senderId: sender._id,
      });

      expect(notification._id).toBeDefined();
      const inDb = await Notification.findById(notification._id);
      expect(inDb).toBeTruthy();
      expect(inDb.type).toBe('mention');
    });

    it('emits socket event to user room', async () => {
      const user = await createUser();
      await createNotification({
        userId: user._id,
        type: 'system',
        title: 'System alert',
        body: 'Test',
      });
      expect(mockTo).toHaveBeenCalledWith(`user:${user._id}`);
      expect(mockEmit).toHaveBeenCalledWith('new_notification', expect.any(Object));
    });
  });

  describe('createMentionNotifications', () => {
    it('creates notification for each mentioned user', async () => {
      const sender = await createUser();
      const mentioned1 = await createUser();
      const mentioned2 = await createUser();

      const fakeMessage = {
        _id: new (require('mongoose').Types.ObjectId)(),
        senderId: sender._id,
        content: `Hello @${mentioned1.username} and @${mentioned2.username}`,
        mentions: [mentioned1._id, mentioned2._id],
      };
      const fakeRoom = { _id: new (require('mongoose').Types.ObjectId)(), name: 'general' };

      await createMentionNotifications(fakeMessage, fakeRoom);

      const notifications = await Notification.find({ type: 'mention' });
      expect(notifications).toHaveLength(2);
    });

    it('skips notification when sender mentions themselves', async () => {
      const sender = await createUser();
      const fakeMessage = {
        _id: new (require('mongoose').Types.ObjectId)(),
        senderId: sender._id,
        content: `Hello @${sender.username}`,
        mentions: [sender._id],
      };
      const fakeRoom = { _id: new (require('mongoose').Types.ObjectId)(), name: 'general' };

      await createMentionNotifications(fakeMessage, fakeRoom);

      const notifications = await Notification.find({ type: 'mention' });
      expect(notifications).toHaveLength(0);
    });

    it('does nothing when mentions array is empty', async () => {
      const sender = await createUser();
      const fakeMessage = { _id: new (require('mongoose').Types.ObjectId)(), senderId: sender._id, mentions: [] };
      const fakeRoom = { _id: new (require('mongoose').Types.ObjectId)(), name: 'general' };

      await createMentionNotifications(fakeMessage, fakeRoom);

      const notifications = await Notification.find();
      expect(notifications).toHaveLength(0);
    });
  });
});

