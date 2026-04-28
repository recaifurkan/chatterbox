/**
 * Integration tests for Scheduled Message routes
 */
const request = require('supertest');
const {
  connectDB, disconnectDB, clearDB, setTestEnv,
  makeAccessToken, createUser, createRoom,
} = require('../helpers/setup');

let mockRedisInstance;
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => mockRedisInstance,
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/storage/minio.provider', () => {
  return jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn().mockResolvedValue('/api/v1/files/test/file.jpg'),
    getStream: jest.fn().mockResolvedValue({ stream: null, contentType: 'application/octet-stream', size: 0 }),
    delete: jest.fn().mockResolvedValue(undefined),
    extractObjectName: jest.fn().mockReturnValue(null),
  }));
});
jest.mock('../../src/config/socket', () => ({
  getIO: () => ({ emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) }),
  initSocket: jest.fn(),
}));

const app = require('../../src/app');

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

function futureDate(seconds = 120) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

describe('POST /api/v1/scheduled', () => {
  it('creates a scheduled message (201)', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room._id.toString(), content: 'Scheduled msg', scheduledAt: futureDate() });

    expect(res.status).toBe(201);
    expect(res.body.data.message.isScheduled).toBe(true);
  });

  it('returns 400 for past scheduledAt', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room._id.toString(), content: 'Late msg', scheduledAt: '2020-01-01T00:00:00Z' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for empty content with no attachments', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room._id.toString(), scheduledAt: futureDate() });

    expect(res.status).toBe(400);
  });

  it('returns 404 if not a room member', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id);
    const token = makeAccessToken(stranger._id);

    const res = await request(app)
      .post('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room._id.toString(), content: 'Hi', scheduledAt: futureDate() });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/scheduled', () => {
  it('returns scheduled messages list', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    await request(app)
      .post('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room._id.toString(), content: 'Msg 1', scheduledAt: futureDate() });

    const res = await request(app)
      .get('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/v1/scheduled/:id', () => {
  it('cancels a scheduled message', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    const createRes = await request(app)
      .post('/api/v1/scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room._id.toString(), content: 'Cancel me', scheduledAt: futureDate() });

    const msgId = createRes.body.data.message._id;

    const res = await request(app)
      .delete(`/api/v1/scheduled/${msgId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent scheduled message', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const mongoose = require('mongoose');

    const res = await request(app)
      .delete(`/api/v1/scheduled/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

