/**
 * Unit tests for socketAuth.middleware.js
 */
const jwt = require('jsonwebtoken');
const { setTestEnv, connectDB, disconnectDB, clearDB, createUser } = require('../../helpers/setup');

let mockRedisClient;
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: () => mockRedisClient,
}));

const { socketAuthMiddleware } = require('../../../src/middlewares/socketAuth.middleware');

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
});

function makeSocket(overrides = {}) {
  return {
    handshake: {
      auth: {},
      headers: {},
      query: {},
      ...overrides.handshake,
    },
    ...overrides,
  };
}

describe('socketAuthMiddleware', () => {
  it('calls next(Error) when no token provided', async () => {
    const socket = makeSocket();
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch(/authentication required/i);
  });

  it('calls next(Error) for expired token', async () => {
    const token = jwt.sign({ userId: 'u1', jti: 'j1' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const socket = makeSocket({ handshake: { auth: { token }, headers: {}, query: {} } });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch(/expired/i);
  });

  it('calls next(Error) for invalid token', async () => {
    const socket = makeSocket({ handshake: { auth: { token: 'bad.token' }, headers: {}, query: {} } });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('calls next(Error) for blacklisted token', async () => {
    const user = await createUser();
    const jti = 'blacklisted-jti';
    const token = jwt.sign({ userId: user._id.toString(), jti }, process.env.JWT_SECRET, { expiresIn: '15m' });
    await mockRedisClient.setex(`blacklist:${jti}`, 900, '1');
    const socket = makeSocket({ handshake: { auth: { token }, headers: {}, query: {} } });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch(/revoked/i);
  });

  it('calls next(Error) for inactive user', async () => {
    const user = await createUser({ isActive: false });
    const token = jwt.sign({ userId: user._id.toString(), jti: 'x' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const socket = makeSocket({ handshake: { auth: { token }, headers: {}, query: {} } });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('sets socket.user and calls next() for valid token', async () => {
    const user = await createUser();
    const token = jwt.sign({ userId: user._id.toString(), jti: 'valid' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const socket = makeSocket({ handshake: { auth: { token }, headers: {}, query: {} } });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toBeDefined();
    expect(socket.userId).toBe(user._id.toString());
  });

  it('accepts token from Authorization header', async () => {
    const user = await createUser();
    const token = jwt.sign({ userId: user._id.toString(), jti: 'hdr' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const socket = makeSocket({
      handshake: {
        auth: {},
        headers: { authorization: `Bearer ${token}` },
        query: {},
      },
    });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts token from query string', async () => {
    const user = await createUser();
    const token = jwt.sign({ userId: user._id.toString(), jti: 'qry' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const socket = makeSocket({ handshake: { auth: {}, headers: {}, query: { token } } });
    const next = jest.fn();
    await socketAuthMiddleware(socket, next);
    expect(next).toHaveBeenCalledWith();
  });
});

