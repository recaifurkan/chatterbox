/**
 * Unit tests for CallHandler
 */
const RedisMock = require('ioredis-mock');
const { SOCKET_EVENTS, REDIS_KEYS, USER_KEY } = require('../../../src/utils/constants');
const RedisService = require('../../../src/services/redis.service');
const CallHandler = require('../../../src/socket/handlers/call.handler');

let redis;
let redisService;

function makeLivekitService(overrides = {}) {
  return {
    pickServer: jest.fn().mockReturnValue(1),
    generateToken: jest.fn().mockResolvedValue('livekit-jwt-token'),
    ...overrides,
  };
}

function buildSocket(userId = 'user-1', username = 'Alice', avatarUrl = null) {
  return {
    userId,
    user: { _id: userId, username, avatarUrl },
    emit: jest.fn(),
    on: jest.fn(),
  };
}

function buildIO() {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  return { to, _toEmit: emit };
}

/** Extracts the handler registered for an event via socket.on */
function getHandler(socket, event) {
  const call = socket.on.mock.calls.find(([e]) => e === event);
  if (!call) throw new Error(`No handler registered for "${event}"`);
  return call[1];
}

beforeEach(async () => {
  redis = new RedisMock();
  redisService = new RedisService({ getRedisClient: () => redis });
  jest.clearAllMocks();
});

afterEach(async () => {
  await redis.flushall();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CallHandler — CALL_INITIATE', () => {
  it('registers socket event listeners on register()', () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket();
    const io = buildIO();
    handler.register(io, socket);
    const events = socket.on.mock.calls.map(([e]) => e);
    expect(events).toContain(SOCKET_EVENTS.CALL_INITIATE);
    expect(events).toContain(SOCKET_EVENTS.CALL_ACCEPT);
    expect(events).toContain(SOCKET_EVENTS.CALL_REJECT);
    expect(events).toContain(SOCKET_EVENTS.CALL_END);
    expect(events).toContain('disconnect');
  });

  it('emits error when targetUserId missing', async () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket();
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_INITIATE);
    await fn({ roomId: 'room-1' }); // no targetUserId
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.objectContaining({ message: 'targetUserId is required' }));
  });

  it('emits CALL_BUSY when target is already in a call', async () => {
    const targetId = 'target-1';
    await redis.setex(REDIS_KEYS.CALL_USER(targetId), 300, 'some-call-id');

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('caller-1');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_INITIATE);
    await fn({ roomId: 'room-1', targetUserId: targetId });
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_BUSY, expect.objectContaining({ targetUserId: targetId }));
  });

  it('emits error when caller is already in a call', async () => {
    const callerId = 'caller-busy';
    await redis.setex(REDIS_KEYS.CALL_USER(callerId), 300, 'existing-call');

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket(callerId);
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_INITIATE);
    await fn({ roomId: 'room-1', targetUserId: 'other-user' });
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.objectContaining({ message: 'You are already in a call' }));
  });

  it('saves call to Redis and notifies target', async () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('caller-1', 'Alice');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_INITIATE);
    await fn({ roomId: 'room-1', targetUserId: 'target-2', callType: 'video' });

    expect(io.to).toHaveBeenCalledWith(USER_KEY('target-2'));
    expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_INCOMING, expect.objectContaining({
      callType: 'video',
      callerId: 'caller-1',
    }));
    // Caller gets confirmation
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_INITIATE, expect.objectContaining({ callType: 'video' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CallHandler — CALL_ACCEPT', () => {
  async function setupActiveCall(callId = 'call-123', callerId = 'caller-1', targetId = 'target-2') {
    const callData = JSON.stringify({
      callId, roomId: 'room-1', callType: 'audio',
      callerId, callerName: 'Alice', callerAvatar: null,
      targetUserId: targetId, status: 'ringing', createdAt: Date.now(),
    });
    await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 300, callData);
    await redis.setex(REDIS_KEYS.CALL_USER(callerId), 300, callId);
    await redis.setex(REDIS_KEYS.CALL_USER(targetId), 300, callId);
    return callData;
  }

  it('emits error when call not found in Redis', async () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('target-2', 'Bob');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_ACCEPT);
    await fn({ callId: 'nonexistent-call' });
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, expect.objectContaining({ message: 'Call not found or expired' }));
  });

  it('generates tokens for both parties and notifies them', async () => {
    const callId = 'call-999';
    await setupActiveCall(callId, 'caller-1', 'target-2');

    const livekit = makeLivekitService({
      generateToken: jest.fn()
        .mockResolvedValueOnce('caller-token')
        .mockResolvedValueOnce('callee-token'),
    });

    const handler = new CallHandler({ redisService, livekitService: livekit });
    const socket = buildSocket('target-2', 'Bob');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_ACCEPT);
    await fn({ callId });

    // Livekit token generated for both
    expect(livekit.generateToken).toHaveBeenCalledTimes(2);

    // Caller notified via io.to()
    expect(io.to).toHaveBeenCalledWith(USER_KEY('caller-1'));
    expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_ACCEPT, expect.objectContaining({
      livekitToken: 'caller-token',
    }));

    // Callee notified via socket.emit
    expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_ACCEPT, expect.objectContaining({
      livekitToken: 'callee-token',
    }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CallHandler — CALL_REJECT', () => {
  it('clears Redis keys and notifies caller', async () => {
    const callId = 'call-rej';
    const callData = JSON.stringify({
      callId, callerId: 'caller-1', targetUserId: 'target-2',
    });
    await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 300, callData);
    await redis.setex(REDIS_KEYS.CALL_USER('caller-1'), 300, callId);
    await redis.setex(REDIS_KEYS.CALL_USER('target-2'), 300, callId);

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('target-2', 'Bob');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_REJECT);
    await fn({ callId });

    expect(io.to).toHaveBeenCalledWith(USER_KEY('caller-1'));
    expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_REJECT, expect.objectContaining({ callId }));

    // Keys should be deleted
    expect(await redis.get(REDIS_KEYS.CALL_ACTIVE(callId))).toBeNull();
    expect(await redis.get(REDIS_KEYS.CALL_USER('caller-1'))).toBeNull();
  });

  it('silently ignores reject when call not found in Redis', async () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('target-2');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_REJECT);
    await fn({ callId: 'ghost-call' });
    expect(io.to).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CallHandler — CALL_END', () => {
  it('clears Redis keys and notifies the other party (caller ends call)', async () => {
    const callId = 'call-end-1';
    const callData = JSON.stringify({
      callId, callerId: 'caller-1', targetUserId: 'target-2',
    });
    await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 500, callData);

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('caller-1'); // caller ends
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_END);
    await fn({ callId });

    expect(io.to).toHaveBeenCalledWith(USER_KEY('target-2'));
    expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_END, expect.objectContaining({ callId, endedBy: 'caller-1' }));
    expect(await redis.get(REDIS_KEYS.CALL_ACTIVE(callId))).toBeNull();
  });

  it('notifies the caller when target ends the call', async () => {
    const callId = 'call-end-2';
    const callData = JSON.stringify({ callId, callerId: 'caller-1', targetUserId: 'target-2' });
    await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 500, callData);

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('target-2'); // target ends
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_END);
    await fn({ callId });

    expect(io.to).toHaveBeenCalledWith(USER_KEY('caller-1'));
  });

  it('silently ignores end when call not found', async () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('anyone');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, SOCKET_EVENTS.CALL_END);
    await fn({ callId: 'gone-call' });
    expect(io.to).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CallHandler — disconnect', () => {
  it('ends active call on socket disconnect', async () => {
    const callId = 'call-disc-1';
    const callData = JSON.stringify({ callId, callerId: 'caller-1', targetUserId: 'target-2' });
    await redis.setex(REDIS_KEYS.CALL_ACTIVE(callId), 500, callData);
    await redis.setex(REDIS_KEYS.CALL_USER('caller-1'), 500, callId);

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('caller-1');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, 'disconnect');
    await fn();

    expect(io.to).toHaveBeenCalledWith(USER_KEY('target-2'));
    expect(io._toEmit).toHaveBeenCalledWith(SOCKET_EVENTS.CALL_END, expect.objectContaining({
      callId,
      reason: 'disconnected',
    }));
    expect(await redis.get(REDIS_KEYS.CALL_ACTIVE(callId))).toBeNull();
  });

  it('does nothing on disconnect when user has no active call', async () => {
    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('idle-user');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, 'disconnect');
    await fn();
    expect(io.to).not.toHaveBeenCalled();
  });

  it('cleans up CALL_USER key when CALL_ACTIVE is already gone on disconnect', async () => {
    await redis.setex(REDIS_KEYS.CALL_USER('caller-1'), 500, 'stale-call-id');
    // No CALL_ACTIVE key set → simulate race condition

    const handler = new CallHandler({ redisService, livekitService: makeLivekitService() });
    const socket = buildSocket('caller-1');
    const io = buildIO();
    handler.register(io, socket);
    const fn = getHandler(socket, 'disconnect');
    await fn();

    expect(await redis.get(REDIS_KEYS.CALL_USER('caller-1'))).toBeNull();
    expect(io.to).not.toHaveBeenCalled();
  });
});

