/**
 * Unit tests for presence.handler.js
 */
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser, createRoom } = require('../../helpers/setup');

let mockRedisClient;
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: () => mockRedisClient,
}));
jest.mock('../../../src/config/socket', () => ({
  getIO: jest.fn(),
  initSocket: jest.fn(),
}));
jest.mock('../../../src/config/minio', () => ({
  uploadBuffer: jest.fn(),
  deleteObject: jest.fn(),
  extractObjectName: jest.fn(),
  minioClient: {},
  BUCKET: 'test',
  ensureBucket: jest.fn().mockResolvedValue(undefined),
}));

const mockPresenceService = {
  setUserOnline: jest.fn().mockResolvedValue(undefined),
  setUserOffline: jest.fn().mockResolvedValue(undefined),
  setUserStatus: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../src/container', () => ({
  presenceService: mockPresenceService,
}));

function buildSocket(user) {
  const handlers = {};
  return {
    userId: user._id.toString(),
    user,
    id: `socket-${user._id}`,
    emit: jest.fn(),
    join: jest.fn(),
    on: (event, handler) => { handlers[event] = handler; },
    _handlers: handlers,
  };
}

function buildIO() {
  return { emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) };
}

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
});

const { registerPresenceHandlers } = require('../../../src/socket/handlers/presence.handler');
const { SOCKET_EVENTS, USER_STATUS } = require('../../../src/utils/constants');
const { setUserOnline, setUserOffline, setUserStatus } = mockPresenceService;

describe('presence.handler', () => {
  it('joins user personal room and sets online on connect', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    registerPresenceHandlers(io, socket);

    // Wait for async connect operations
    await new Promise((r) => setTimeout(r, 100));

    expect(socket.join).toHaveBeenCalledWith(`user:${user._id}`);
    expect(setUserOnline).toHaveBeenCalledWith(user._id.toString(), socket.id);
    expect(io.emit).toHaveBeenCalledWith(SOCKET_EVENTS.USER_STATUS_CHANGE, expect.objectContaining({
      userId: user._id.toString(),
      status: USER_STATUS.ONLINE,
    }));
  });

  it('re-joins all active rooms the user belongs to', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const io = buildIO();
    const socket = buildSocket(user);
    registerPresenceHandlers(io, socket);

    await new Promise((r) => setTimeout(r, 100));

    expect(socket.join).toHaveBeenCalledWith(`room:${room._id}`);
  });

  it('SET_STATUS updates Redis and broadcasts', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    registerPresenceHandlers(io, socket);

    await socket._handlers[SOCKET_EVENTS.SET_STATUS]({ status: 'busy' });

    expect(setUserStatus).toHaveBeenCalledWith(user._id.toString(), 'busy');
    expect(io.emit).toHaveBeenCalledWith(SOCKET_EVENTS.USER_STATUS_CHANGE, expect.objectContaining({ status: 'busy' }));
  });

  it('SET_STATUS ignores invalid status values', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    registerPresenceHandlers(io, socket);
    jest.clearAllMocks();

    await socket._handlers[SOCKET_EVENTS.SET_STATUS]({ status: 'invalid_status' });

    expect(setUserStatus).not.toHaveBeenCalled();
  });

  it('disconnect sets user offline if socket id matches', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    registerPresenceHandlers(io, socket);

    // Store our socket id in redis
    await mockRedisClient.setex(`socket:user:${user._id}`, 86400, socket.id);

    await socket._handlers['disconnect']();
    await new Promise((r) => setTimeout(r, 2500)); // wait for 2s delay in handler

    expect(setUserOffline).toHaveBeenCalledWith(user._id.toString());
  }, 10000);
});

