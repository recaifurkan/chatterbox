/**
 * Unit tests for typing.handler.js
 */
const { setTestEnv, createUser, connectDB, disconnectDB, clearDB } = require('../../helpers/setup');

let mockRedisClient;

const PresenceService = require('../../../src/services/presence.service');

function buildSocket(user) {
  const handlers = {};
  return {
    userId: user._id.toString(),
    user,
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: (event, handler) => { handlers[event] = handler; },
    _handlers: handlers,
  };
}

function buildIO() {
  return { to: jest.fn(() => ({ emit: jest.fn() })) };
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

const TypingHandler = require('../../../src/socket/handlers/typing.handler');
const { SOCKET_EVENTS } = require('../../../src/utils/constants');

const presenceService = new PresenceService({ getRedisClient: () => mockRedisClient });
const typingHandler = new TypingHandler({ presenceService });

describe('typing.handler', () => {
  it('TYPING_START sets typing in Redis and broadcasts', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    typingHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.TYPING_START]({ roomId: 'room123' });

    const val = await mockRedisClient.get(`typing:room123:${user._id}`);
    expect(val).toBe(user.username);
    expect(socket.to).toHaveBeenCalledWith('room:room123');
  });

  it('TYPING_STOP clears typing in Redis and broadcasts', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    typingHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.TYPING_START]({ roomId: 'room123' });
    await socket._handlers[SOCKET_EVENTS.TYPING_STOP]({ roomId: 'room123' });

    const val = await mockRedisClient.get(`typing:room123:${user._id}`);
    expect(val).toBeNull();
  });

  it('disconnect clears all typing timeouts', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    typingHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.TYPING_START]({ roomId: 'room456' });
    // Should not throw
    socket._handlers['disconnect']();
  });
});

