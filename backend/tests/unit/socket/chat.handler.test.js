/**
 * Unit tests for chat.handler.js socket handler
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, setTestEnv, createUser, createRoom, createMessage } = require('../../helpers/setup');

const mockNotificationService = {
  createNotification: jest.fn().mockResolvedValue(undefined),
  createMentionNotifications: jest.fn().mockResolvedValue(undefined),
};

const mockMessageServiceForSocket = {
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
};

let mockIO;

function buildSocket(user) {
  return {
    userId: user._id.toString(),
    user,
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
}

function buildIO() {
  const emitFn = jest.fn();
  const toFn = jest.fn(() => ({ emit: emitFn }));
  return { to: toFn, emit: emitFn, _lastEmit: emitFn, _to: toFn };
}

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});

afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
});

const ChatHandler = require('../../../src/socket/handlers/chat.handler');
const { SOCKET_EVENTS } = require('../../../src/utils/constants');

const chatHandler = new ChatHandler({
  notificationService: mockNotificationService,
  messageService: mockMessageServiceForSocket,
});

function registerAndGetHandlers(io, socket) {
  const handlers = {};
  const origOn = socket.on;
  socket.on = (event, handler) => {
    handlers[event] = handler;
  };
  chatHandler.register(io, socket);
  socket.on = origOn;
  return handlers;
}

describe('chat.handler - join_room', () => {
  it('emits room_joined on successful join of public room', async () => {
    const user = await createUser();
    const room = await createRoom(user._id, { type: 'public' });
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.JOIN_ROOM]({ roomId: room._id.toString() });

    expect(socket.join).toHaveBeenCalledWith(`room:${room._id}`);
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ROOM_JOINED, expect.any(Object));
  });

  it('emits error when room not found', async () => {
    const user = await createUser();
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.JOIN_ROOM]({ roomId: new mongoose.Types.ObjectId().toString() });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });

  it('emits error for private room when not a member', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id, { type: 'private', inviteCode: 'abc' });
    mockIO = buildIO();
    const socket = buildSocket(stranger);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.JOIN_ROOM]({ roomId: room._id.toString() });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });
});

describe('chat.handler - leave_room', () => {
  it('emits room_left on leave', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    handlers[SOCKET_EVENTS.LEAVE_ROOM]({ roomId: room._id.toString() });

    expect(socket.leave).toHaveBeenCalledWith(`room:${room._id}`);
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ROOM_LEFT, expect.any(Object));
  });
});

describe('chat.handler - send_message', () => {
  it('creates and broadcasts a message', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    mockIO = buildIO();
    const socket = buildSocket(user);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: 'Hello world',
      type: 'text',
    });

    expect(mockIO.to).toHaveBeenCalledWith(`room:${room._id}`);
  });

  it('emits error when user is not a room member', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id);
    mockIO = buildIO();
    const socket = buildSocket(stranger);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: 'Intruder msg',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });

  it('emits error when blocked in DM', async () => {
    const user1 = await createUser();
    const user2 = await createUser({ blockedUsers: [user1._id] });
    const Room = require('../../../src/models/Room');
    const room = await Room.create({
      name: `dm_test`,
      type: 'dm',
      createdBy: user1._id,
      members: [
        { user: user1._id, role: 'member' },
        { user: user2._id, role: 'member' },
      ],
    });
    mockIO = buildIO();
    const socket = buildSocket(user1);
    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.SEND_MESSAGE]({
      roomId: room._id.toString(),
      content: 'Hi blocked',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });
});

describe('chat.handler - edit_message', () => {
  it('edits own message and broadcasts', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id, { content: 'Original' });
    mockIO = buildIO();
    const socket = buildSocket(user);

    mockMessageServiceForSocket.editMessage.mockResolvedValueOnce({
      message: { _id: msg._id, roomId: room._id, content: 'Updated content', isEdited: true },
    });

    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.EDIT_MESSAGE]({
      messageId: msg._id.toString(),
      content: 'Updated content',
    });

    expect(mockIO.to).toHaveBeenCalledWith(`room:${room._id}`);
  });

  it('emits error when message not found', async () => {
    const user = await createUser();
    mockIO = buildIO();
    const socket = buildSocket(user);

    const { NotFoundError } = require('../../../src/utils/AppError');
    mockMessageServiceForSocket.editMessage.mockRejectedValueOnce(new NotFoundError('Message not found'));

    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.EDIT_MESSAGE]({
      messageId: new mongoose.Types.ObjectId().toString(),
      content: 'Whatever',
    });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });
});

describe('chat.handler - delete_message', () => {
  it('soft-deletes message and broadcasts', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    mockIO = buildIO();
    const socket = buildSocket(user);

    mockMessageServiceForSocket.deleteMessage.mockResolvedValueOnce({
      messageId: msg._id, roomId: room._id,
    });

    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.DELETE_MESSAGE]({ messageId: msg._id.toString() });

    expect(mockIO.to).toHaveBeenCalledWith(`room:${room._id}`);
  });

  it('emits error when not owner and not admin', async () => {
    const owner = await createUser();
    const member = await createUser();
    const room = await createRoom(owner._id, {
      members: [{ user: owner._id, role: 'owner' }, { user: member._id, role: 'member' }],
    });
    const msg = await createMessage(room._id, owner._id);
    mockIO = buildIO();
    const socket = buildSocket(member);

    const { ForbiddenError } = require('../../../src/utils/AppError');
    mockMessageServiceForSocket.deleteMessage.mockRejectedValueOnce(new ForbiddenError('Permission denied'));

    const handlers = registerAndGetHandlers(mockIO, socket);

    await handlers[SOCKET_EVENTS.DELETE_MESSAGE]({ messageId: msg._id.toString() });

    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.any(Object));
  });
});

