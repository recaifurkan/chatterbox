/**
 * Unit tests for auth.middleware.js
 */
const jwt = require('jsonwebtoken');
const { setTestEnv, connectDB, disconnectDB, clearDB, createUser } = require('../../helpers/setup');

// Jest requires mock variables to be prefixed with 'mock'
let mockRedisInstance;
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: () => mockRedisInstance,
}));

const { authenticate, authorize } = require('../../../src/middlewares/auth.middleware');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

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

describe('auth.middleware - authenticate', () => {
  it('returns 401 when no authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc' } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for expired token', async () => {
    const token = jwt.sign({ userId: 'u1', jti: 'j1' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toMatch(/expired/i);
  });

  it('returns 401 for invalid/malformed token', async () => {
    const req = { headers: { authorization: 'Bearer not.a.token' } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for blacklisted token', async () => {
    const user = await createUser();
    const jti = 'blacklisted-jti';
    const token = jwt.sign({ userId: user._id.toString(), jti }, process.env.JWT_SECRET, { expiresIn: '15m' });
    await mockRedisInstance.setex(`blacklist:${jti}`, 900, '1');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for inactive user', async () => {
    const user = await createUser({ isActive: false });
    const jti = 'some-jti';
    const token = jwt.sign({ userId: user._id.toString(), jti }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next() and sets req.user for valid token', async () => {
    const user = await createUser();
    const jti = 'valid-jti';
    const token = jwt.sign({ userId: user._id.toString(), jti }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.tokenJti).toBe(jti);
  });
});

describe('auth.middleware - authorize', () => {
  it('returns 401 if req.user not set', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 if user does not have required role', () => {
    const req = { user: { role: 'member' } };
    const res = mockRes();
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next() when user has required role', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when no roles specified (just authenticated)', () => {
    const req = { user: { role: 'member' } };
    const res = mockRes();
    const next = jest.fn();
    authorize()(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

