/**
 * Unit tests for readReceipt.handler.js
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

const { messageService } = require('../../../src/container');
const ReadReceiptHandler = require('../../../src/socket/handlers/readReceipt.handler');
const readReceiptHandler = new ReadReceiptHandler({ messageService });

function buildSocket(user) {
  const handlers = {};
  return {
    userId: user._id.toString(),
    user,
    emit: jest.fn(),
    on: (event, handler) => { handlers[event] = handler; },
    _handlers: handlers,
  };
}

function buildIO() {
  const emitFn = jest.fn();
  return { to: jest.fn(() => ({ emit: emitFn })), _emitFn: emitFn };
}

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});
afterAll(async () => { await disconnectDB(); });
afterEach(async () => { await clearDB(); jest.clearAllMocks(); });

const { SOCKET_EVENTS } = require('../../../src/utils/constants');
const Message = require('../../../src/models/Message');

describe('readReceipt.handler - mark_read', () => {
  it('marks messages as read and broadcasts', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    const io = buildIO();
    const socket = buildSocket(user);
    readReceiptHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.MARK_READ]({
      roomId: room._id.toString(),
      messageIds: [msg._id.toString()],
    });

    expect(io.to).toHaveBeenCalledWith(`room:${room._id}`);
    const updated = await Message.findById(msg._id);
    expect(updated.readBy.some((r) => r.user.toString() === user._id.toString())).toBe(true);
  });

  it('does nothing when messageIds is empty', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const io = buildIO();
    const socket = buildSocket(user);
    readReceiptHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.MARK_READ]({
      roomId: room._id.toString(),
      messageIds: [],
    });

    expect(io.to).not.toHaveBeenCalled();
  });
});

