/**
 * Unit tests for reaction.handler.js
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser, createRoom, createMessage } = require('../../helpers/setup');

// Mock infrastructure so container loads successfully
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn(),
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/config/socket', () => ({
  getIO: jest.fn(),
  initializeSocket: jest.fn(),
}));
jest.mock('../../../src/services/storage/minio.provider', () => {
  return jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn(), delete: jest.fn(), extractObjectName: jest.fn(),
    getStream: jest.fn(),
  }));
});

// Real messageService from container (backed by real DB, mocked infra)
const { messageService } = require('../../../src/container');
const ReactionHandler = require('../../../src/socket/handlers/reaction.handler');
const reactionHandler = new ReactionHandler({ messageService });

let mockIO;

function buildSocket(user) {
  return {
    userId: user._id.toString(),
    user,
    emit: jest.fn(),
    on: jest.fn(),
  };
}

function buildIO() {
  const emitFn = jest.fn();
  return { to: jest.fn(() => ({ emit: emitFn })) };
}

function registerAndGetHandlers(io, socket) {
  const handlers = {};
  socket.on = (event, handler) => { handlers[event] = handler; };
  reactionHandler.register(io, socket);
  return handlers;
}

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});
afterAll(async () => { await disconnectDB(); });
afterEach(async () => { await clearDB(); jest.clearAllMocks(); });

const { SOCKET_EVENTS } = require('../../../src/utils/constants');

describe('reaction.handler - add_reaction', () => {
  it('adds a new reaction and broadcasts', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.ADD_REACTION]({ messageId: msg._id.toString(), emoji: '👍' });

    expect(mockIO.to).toHaveBeenCalledWith(`room:${room._id}`);
  });

  it('does nothing if message not found or deleted', async () => {
    const user = await createUser();
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.ADD_REACTION]({
      messageId: new mongoose.Types.ObjectId().toString(),
      emoji: '❤️',
    });

    expect(mockIO.to).not.toHaveBeenCalled();
  });

  it('ignores duplicate reaction from same user', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id, {
      reactions: [{ emoji: '🎉', users: [user._id], count: 1 }],
    });
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.ADD_REACTION]({ messageId: msg._id.toString(), emoji: '🎉' });

    // Should not add again — count stays 1
    const Message = require('../../../src/models/Message');
    const updated = await Message.findById(msg._id);
    expect(updated.reactions[0].count).toBe(1);
  });
});

describe('reaction.handler - remove_reaction', () => {
  it('removes reaction and broadcasts', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id, {
      reactions: [{ emoji: '🎉', users: [user._id], count: 1 }],
    });
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.REMOVE_REACTION]({ messageId: msg._id.toString(), emoji: '🎉' });

    expect(mockIO.to).toHaveBeenCalledWith(`room:${room._id}`);
    const Message = require('../../../src/models/Message');
    const updated = await Message.findById(msg._id);
    expect(updated.reactions).toHaveLength(0);
  });

  it('does nothing if message not found', async () => {
    const user = await createUser();
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.REMOVE_REACTION]({
      messageId: new mongoose.Types.ObjectId().toString(),
      emoji: '👍',
    });

    expect(mockIO.to).not.toHaveBeenCalled();
  });
});

