/**
 * Integration tests for Auth routes
 */
const request = require('supertest');
const { connectDB, disconnectDB, clearDB, setTestEnv, makeAccessToken, makeRefreshToken, createUser } = require('../helpers/setup');

// Mock redis and minio
let mockRedisInstance;
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => mockRedisInstance,
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/config/minio', () => ({
  getMinioClient: jest.fn(),
  uploadBuffer: jest.fn().mockResolvedValue('http://minio/test/avatar.jpg'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  extractObjectName: jest.fn().mockReturnValue('avatars/test.jpg'),
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

afterAll(async () => {
  await disconnectDB();
});

afterEach(async () => {
  await clearDB();
  await mockRedisInstance.flushall();
});

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns tokens (201)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'testuser', email: 'test@example.com', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('returns 409 on duplicate email', async () => {
    await createUser({ email: 'dup@example.com', username: 'user1' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'user2', email: 'dup@example.com', password: 'Password123!' });
    expect(res.status).toBe(409);
  });

  it('returns 409 on duplicate username', async () => {
    await createUser({ email: 'a@example.com', username: 'dupname' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'dupname', email: 'b@example.com', password: 'Password123!' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and tokens for valid credentials', async () => {
    await createUser({ email: 'login@example.com', username: 'loginuser', password: 'Pass123!' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'Pass123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('returns 401 for wrong password', async () => {
    await createUser({ email: 'wrong@example.com', username: 'wrongpass', password: 'RealPass123!' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'wrong@example.com', password: 'BadPass' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Pass123!' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for inactive account', async () => {
    await createUser({ email: 'inactive@example.com', username: 'inactive', password: 'Pass123!', isActive: false });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@example.com', password: 'Pass123!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });

  it('logs out successfully with valid token', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns new tokens for valid refresh token', async () => {
    const user = await createUser();
    const token = makeRefreshToken(user._id);
    await mockRedisInstance.setex(`refresh:${user._id}`, 86400, token);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('returns 400 when no refresh token provided', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'bad.token' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns current user', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

