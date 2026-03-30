/**
 * Integration tests for User routes
 */
const request = require('supertest');
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
  getMinioClient: jest.fn(),
  uploadBuffer: jest.fn().mockResolvedValue('http://minio/test/avatar.jpg'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  extractObjectName: jest.fn().mockReturnValue(null),
  ensureBucket: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/config/socket', () => ({
  getIO: () => ({ emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) }),
  initSocket: jest.fn(),
}));
jest.mock('../../src/services/media.service', () => {
  return jest.fn().mockImplementation(() => ({
    processAvatar: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
    processImage: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
    processVideo: jest.fn().mockResolvedValue(Buffer.from('fake-video')),
    generateThumbnail: jest.fn().mockResolvedValue(Buffer.from('fake-thumb')),
    probe: jest.fn().mockResolvedValue({}),
  }));
});

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

describe('GET /api/v1/users/:userId', () => {
  it('returns user profile (200)', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .get(`/api/v1/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(user.username);
  });

  it('returns 404 for non-existent user', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const mongoose = require('mongoose');
    const res = await request(app)
      .get(`/api/v1/users/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/users/me', () => {
  it('updates username and bio', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: `newname_${Date.now()}`, bio: 'Updated bio' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.bio).toBe('Updated bio');
  });

  it('returns 409 on duplicate username', async () => {
    const user1 = await createUser({ username: 'takenname', email: 'u1@test.com' });
    const user2 = await createUser({ username: 'otheruser', email: 'u2@test.com' });
    const token = makeAccessToken(user2._id);
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'takenname' });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/v1/users/me/status', () => {
  it('updates status', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .patch('/api/v1/users/me/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'busy' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('busy');
  });
});

describe('GET /api/v1/users/search', () => {
  it('returns matching users', async () => {
    await createUser({ username: 'searchable', email: 'srch@test.com' });
    const requester = await createUser({ username: 'requester', email: 'req@test.com' });
    const token = makeAccessToken(requester._id);
    const res = await request(app)
      .get('/api/v1/users/search?q=searchable')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 if query too short', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .get('/api/v1/users/search?q=a')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/users/:userId/block', () => {
  it('blocks a user', async () => {
    const user = await createUser();
    const target = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post(`/api/v1/users/${target._id}/block`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 400 when blocking self', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post(`/api/v1/users/${user._id}/block`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/users/:userId/block', () => {
  it('unblocks a user', async () => {
    const user = await createUser();
    const target = await createUser();
    const token = makeAccessToken(user._id);

    await request(app)
      .post(`/api/v1/users/${target._id}/block`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/api/v1/users/${target._id}/block`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/users/me/avatar', () => {
  it('returns 400 when no file provided', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('uploads avatar successfully', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('fake image data'), { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBeTruthy();
  });
});

