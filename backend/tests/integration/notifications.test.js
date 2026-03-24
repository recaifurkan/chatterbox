/**
 * Integration tests for Notification routes
 */
const request = require('supertest');
const mongoose = require('mongoose');
const {
  connectDB, disconnectDB, clearDB, setTestEnv,
  makeAccessToken, createUser,
} = require('../helpers/setup');

let mockRedisInstance;
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => mockRedisInstance,
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/config/minio', () => ({
  ensureBucket: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/config/socket', () => ({
  getIO: () => ({ emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) }),
  initSocket: jest.fn(),
}));

const app = require('../../src/app');
const Notification = require('../../src/models/Notification');

beforeAll(async () => {
  setTestEnv();
  const RedisMock = require('ioredis-mock');
  mockRedisInstance = new RedisMock();
  await connectDB();
});

afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  await mockRedisInstance.flushall();
});

async function createNotificationDoc(userId, overrides = {}) {
  return Notification.create({
    userId,
    type: 'system',
    title: 'Test Notification',
    body: 'Test body',
    ...overrides,
  });
}

describe('GET /api/v1/notifications', () => {
  it('returns all notifications for user', async () => {
    const user = await createUser();
    await createNotificationDoc(user._id);
    await createNotificationDoc(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(2);
  });

  it('returns only unread notifications with ?unread=true', async () => {
    const user = await createUser();
    await createNotificationDoc(user._id, { read: true });
    await createNotificationDoc(user._id, { read: false });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .get('/api/v1/notifications?unread=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.every((n) => n.read === false)).toBe(true);
  });

  it('returns unreadCount', async () => {
    const user = await createUser();
    await createNotificationDoc(user._id, { read: false });
    await createNotificationDoc(user._id, { read: false });
    await createNotificationDoc(user._id, { read: true });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.unreadCount).toBe(2);
  });
});

describe('PATCH /api/v1/notifications/:id/read', () => {
  it('marks a notification as read', async () => {
    const user = await createUser();
    const notif = await createNotificationDoc(user._id, { read: false });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent or another users notification', async () => {
    const user = await createUser();
    const other = await createUser();
    const notif = await createNotificationDoc(other._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/notifications/read-all', () => {
  it('marks all notifications as read', async () => {
    const user = await createUser();
    await createNotificationDoc(user._id, { read: false });
    await createNotificationDoc(user._id, { read: false });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const unread = await Notification.countDocuments({ userId: user._id, read: false });
    expect(unread).toBe(0);
  });
});

describe('DELETE /api/v1/notifications/:id', () => {
  it('deletes a notification', async () => {
    const user = await createUser();
    const notif = await createNotificationDoc(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .delete(`/api/v1/notifications/${notif._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const deleted = await Notification.findById(notif._id);
    expect(deleted).toBeNull();
  });

  it('does not delete another users notification', async () => {
    const user = await createUser();
    const other = await createUser();
    const notif = await createNotificationDoc(other._id);
    const token = makeAccessToken(user._id);

    await request(app)
      .delete(`/api/v1/notifications/${notif._id}`)
      .set('Authorization', `Bearer ${token}`);

    const stillExists = await Notification.findById(notif._id);
    expect(stillExists).toBeTruthy();
  });
});

