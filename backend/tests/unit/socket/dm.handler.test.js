/**
 * Unit tests for dm.handler.js
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser } = require('../../helpers/setup');

const mockNotificationService = {
  createNotification: jest.fn().mockResolvedValue({}),
};

function buildSocket(user) {
  const handlers = {};
  return {
    userId: user._id.toString(),
    user,
    emit: jest.fn(),
    join: jest.fn(),
    on: (event, handler) => { handlers[event] = handler; },
    _handlers: handlers,
  };
}

function buildIO() {
  const emitFn = jest.fn();
  return { to: jest.fn(() => ({ emit: emitFn })), emit: emitFn };
}

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});
afterAll(async () => { await disconnectDB(); });
afterEach(async () => { await clearDB(); jest.clearAllMocks(); });

const DMHandler = require('../../../src/socket/handlers/dm.handler');
const { SOCKET_EVENTS } = require('../../../src/utils/constants');

const dmHandler = new DMHandler({ notificationService: mockNotificationService });

describe('dm.handler - send_dm', () => {
  it('creates a DM room and message, emits to both users', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    const io = buildIO();
    const socket = buildSocket(sender);
    dmHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.SEND_DM]({
      targetUserId: receiver._id.toString(),
      content: 'Hello!',
    });

    expect(io.to).toHaveBeenCalledWith(`user:${sender._id}`);
    expect(io.to).toHaveBeenCalledWith(`user:${receiver._id}`);
    expect(socket.join).toHaveBeenCalled();
  });

  it('emits error when sending DM to self', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    dmHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.SEND_DM]({
      targetUserId: user._id.toString(),
      content: 'To myself',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });

  it('emits error when target user not found', async () => {
    const user = await createUser();
    const io = buildIO();
    const socket = buildSocket(user);
    dmHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.SEND_DM]({
      targetUserId: new mongoose.Types.ObjectId().toString(),
      content: 'Nobody here',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });

  it('emits error when target user has blocked sender', async () => {
    const sender = await createUser();
    const blocker = await createUser({ blockedUsers: [] });
    // Add sender to blocker's blockedUsers
    const User = require('../../../src/models/User');
    await User.findByIdAndUpdate(blocker._id, { $push: { blockedUsers: sender._id } });
    const updatedBlocker = await User.findById(blocker._id);

    const io = buildIO();
    const socket = buildSocket(sender);
    dmHandler.register(io, socket);

    await socket._handlers[SOCKET_EVENTS.SEND_DM]({
      targetUserId: updatedBlocker._id.toString(),
      content: 'Blocked msg',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });

  it('reuses existing DM room', async () => {
    const sender = await createUser();
    const receiver = await createUser();
    const io = buildIO();
    const socket = buildSocket(sender);
    dmHandler.register(io, socket);

    // Create DM twice — second time should reuse existing room
    await socket._handlers[SOCKET_EVENTS.SEND_DM]({ targetUserId: receiver._id.toString(), content: 'First' });
    await socket._handlers[SOCKET_EVENTS.SEND_DM]({ targetUserId: receiver._id.toString(), content: 'Second' });

    const Room = require('../../../src/models/Room');
    const dmRooms = await Room.find({ type: 'dm' });
    expect(dmRooms).toHaveLength(1);
  });
});

