/**
 * Integration tests for Search routes and Health endpoint
 */
const request = require('supertest');
const {
  connectDB, disconnectDB, clearDB, setTestEnv,
  makeAccessToken, createUser, createRoom, createMessage,
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

describe('GET /health', () => {
  it('returns 200 with status OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe('GET /api/v1/search/messages', () => {
  it('returns 200 with search results', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .get('/api/v1/search/messages?q=test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toBeDefined();
  });

  it('filters by roomId', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .get(`/api/v1/search/messages?roomId=${room._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/search/messages?q=hello');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/users/search', () => {
  it('returns matching users (200)', async () => {
    const requester = await createUser({ username: 'requester1', email: 'req1@test.com' });
    await createUser({ username: 'findme', email: 'findme@test.com' });
    const token = makeAccessToken(requester._id);

    const res = await request(app)
      .get('/api/v1/users/search?q=findme')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

