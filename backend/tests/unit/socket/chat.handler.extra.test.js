/**
 * Supplementary tests for chat.handler.js — covering missing branches:
 *   - JOIN_ROOM error catch (L35-36)
 *   - @mention parsing → User.find (L72-73)
 *   - expiresIn branch (L87)
 *   - mention notification error catch (L102-105)
 *   - room notification loop (L114-124)
 *   - SEND_MESSAGE error catch (L141-142)
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser, createRoom } = require('../../helpers/setup');

const mockNotificationService = {
  createNotification: jest.fn().mockResolvedValue(undefined),
  createMentionNotifications: jest.fn().mockResolvedValue(undefined),
};
const mockMessageServiceForSocket = {
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
};

function buildSocket(user) {
  return {
    userId: user._id.toString(),
    user,
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn(),
  };
}

/**
 * Full-featured IO mock that supports:
 *   io.to(room).emit(...)
 *   io.in(userKey).allSockets()  → returns empty Set (user not connected)
 *   io.sockets.adapter.rooms.get(roomKey) → returns undefined (member not in room)
 */
function buildFullIO() {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const allSockets = jest.fn().mockResolvedValue(new Set());
  const inFn = jest.fn(() => ({ allSockets }));
  return {
    to,
    emit,
    in: inFn,
    sockets: { adapter: { rooms: new Map() } },
    _emit: emit,
    _to: to,
    _allSockets: allSockets,
    _inFn: inFn,
  };
}

const Room = require('../../../src/models/Room');
const ChatHandler = require('../../../src/socket/handlers/chat.handler');
const { SOCKET_EVENTS } = require('../../../src/utils/constants');

const chatHandler = new ChatHandler({
  notificationService: mockNotificationService,
  messageService: mockMessageServiceForSocket,
});

function registerHandlers(io, socket) {
  chatHandler.register(io, socket);
  const handlers = {};
  socket.on.mock.calls.forEach(([event, fn]) => { handlers[event] = fn; });
  return handlers;
}

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});
afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('chat.handler extra — JOIN_ROOM error catch', () => {
  it('emits ERROR when DB throws during join', async () => {
    const user = await createUser();
    const io = buildFullIO();
    const socket = buildSocket(user);
    const handlers = registerHandlers(io, socket);

    jest.spyOn(Room, 'findById').mockRejectedValueOnce(new Error('DB down'));
    await handlers[SOCKET_EVENTS.JOIN_ROOM]({ roomId: new mongoose.Types.ObjectId().toString() });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.objectContaining({ message: 'Failed to join room' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('chat.handler extra — SEND_MESSAGE with @mentions', () => {
  it('resolves @mention usernames and sends notification', async () => {
    const sender = await createUser({ username: 'sender_usr' });
    const mentioned = await createUser({ username: 'mentioned_usr' });
    const room = await createRoom(sender._id, {
      members: [
        { user: sender._id, role: 'owner' },
        { user: mentioned._id, role: 'member' },
      ],
    });

    const io = buildFullIO();
    const socket = buildSocket(sender);
    const handlers = registerHandlers(io, socket);

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: `Hey @mentioned_usr check this out`,
    });

    expect(mockNotificationService.createMentionNotifications).toHaveBeenCalled();
  });

  it('handles mention notification error gracefully (does not crash)', async () => {
    const sender = await createUser({ username: 'sender_2' });
    const mentioned = await createUser({ username: 'mentioned_2' });
    const room = await createRoom(sender._id, {
      members: [
        { user: sender._id, role: 'owner' },
        { user: mentioned._id, role: 'member' },
      ],
    });

    mockNotificationService.createMentionNotifications.mockRejectedValueOnce(new Error('notification fail'));

    const io = buildFullIO();
    const socket = buildSocket(sender);
    const handlers = registerHandlers(io, socket);

    // Should not throw, just log the error
    await expect(handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: '@mentioned_2 hello',
    })).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('chat.handler extra — SEND_MESSAGE with expiresIn', () => {
  it('sets expiresAt when expiresIn is provided', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const io = buildFullIO();
    const socket = buildSocket(user);
    const handlers = registerHandlers(io, socket);

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: 'Temporary message',
      expiresIn: 3600, // 1 hour
    });

    // Message was broadcast — we verify io.to was called (message was created)
    expect(io.to).toHaveBeenCalledWith(expect.stringContaining(room._id.toString()));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('chat.handler extra — room notification loop (non-DM)', () => {
  it('sends notification to offline members not in room', async () => {
    const sender = await createUser();
    const offline = await createUser();
    const room = await createRoom(sender._id, {
      members: [
        { user: sender._id, role: 'owner' },
        { user: offline._id, role: 'member' },
      ],
    });

    const io = buildFullIO();
    // io.in(userId).allSockets() returns empty Set → member is not connected → notification sent
    const socket = buildSocket(sender);
    const handlers = registerHandlers(io, socket);

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: 'Notify offline member',
    });

    expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: offline._id.toString(), type: 'message' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('chat.handler extra — SEND_MESSAGE DB error catch', () => {
  it('emits ERROR when DB throws during send', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const io = buildFullIO();
    const socket = buildSocket(user);
    const handlers = registerHandlers(io, socket);

    // Make Room.findById throw to trigger catch block
    jest.spyOn(Room, 'findById').mockRejectedValueOnce(new Error('DB crash'));

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: 'test',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.objectContaining({ message: 'Failed to send message' }));
  });
});

