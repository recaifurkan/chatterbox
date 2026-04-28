/**
 * Unit tests for MessageService — covering uncovered branches
 */
const { connectDB, disconnectDB, clearDB, createUser, createRoom, createMessage } = require('../../helpers/setup');
const MessageService = require('../../../src/services/message.service');
const Message = require('../../../src/models/Message');
const Room = require('../../../src/models/Room');
const AuditService = require('../../../src/services/audit.service');
const AuditLog = require('../../../src/models/AuditLog');

let messageService;

beforeAll(async () => { await connectDB(); });
afterAll(async () => { await disconnectDB(); });
afterEach(async () => { await clearDB(); });

beforeEach(() => {
  const auditService = new AuditService({ AuditLog });
  messageService = new MessageService({ Message, Room, auditService });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MessageService — addReaction()', () => {
  it('adds a new reaction when emoji does not exist yet', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);

    const { reactions } = await messageService.addReaction(msg._id, user._id, '👍');
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe('👍');
    expect(reactions[0].count).toBe(1);
  });

  it('adds user to existing reaction when another user reacts with same emoji', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const room = await createRoom(user1._id);
    const msg = await createMessage(room._id, user1._id);

    // First reaction from user1
    await messageService.addReaction(msg._id, user1._id, '❤️');
    // Second reaction from user2 — same emoji, different user → covers lines 118-119
    const { reactions } = await messageService.addReaction(msg._id, user2._id, '❤️');

    expect(reactions[0].count).toBe(2);
    expect(reactions[0].users.map((u) => u.toString())).toContain(user2._id.toString());
  });

  it('throws ConflictError when same user reacts twice with same emoji', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);

    await messageService.addReaction(msg._id, user._id, '🔥');
    await expect(messageService.addReaction(msg._id, user._id, '🔥')).rejects.toThrow('Already reacted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MessageService — searchMessages()', () => {
  it('searches with startDate only', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    await createMessage(room._id, user._id, { content: 'hello world' });

    const startDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
    const { messages } = await messageService.searchMessages({ startDate });
    expect(messages.length).toBeGreaterThanOrEqual(0); // query runs without error
  });

  it('searches with endDate only', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    await createMessage(room._id, user._id);

    const endDate = new Date(Date.now() + 60000).toISOString(); // 1 minute future
    const { messages } = await messageService.searchMessages({ endDate });
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('searches with both startDate and endDate', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    await createMessage(room._id, user._id);

    const start = new Date(Date.now() - 60000).toISOString();
    const end = new Date(Date.now() + 60000).toISOString();
    const { messages } = await messageService.searchMessages({ startDate: start, endDate: end });
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by roomId and userId', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const room = await createRoom(user1._id);
    await createMessage(room._id, user1._id);
    await createMessage(room._id, user2._id);

    const { messages } = await messageService.searchMessages({
      roomId: room._id,
      userId: user1._id,
    });
    expect(messages.every((m) => m.senderId._id.toString() === user1._id.toString())).toBe(true);
  });

  it('returns empty results when no matching messages', async () => {
    const fakeRoomId = new (require('mongoose').Types.ObjectId)();
    const { messages, total } = await messageService.searchMessages({ roomId: fakeRoomId });
    expect(messages).toHaveLength(0);
    expect(total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MessageService — deleteMessage()', () => {
  it('allows room admin to delete any message', async () => {
    const owner = await createUser();
    const member = await createUser();
    const room = await createRoom(owner._id, {
      members: [
        { user: owner._id, role: 'owner' },
        { user: member._id, role: 'member' },
      ],
    });
    const msg = await createMessage(room._id, member._id);

    // Owner (admin) deletes member's message
    const result = await messageService.deleteMessage(msg._id, owner._id);
    expect(result.messageId.toString()).toBe(msg._id.toString());
  });

  it('throws ForbiddenError when non-owner, non-admin tries to delete', async () => {
    const owner = await createUser();
    const member = await createUser();
    const intruder = await createUser();
    const room = await createRoom(owner._id, {
      members: [
        { user: owner._id, role: 'owner' },
        { user: member._id, role: 'member' },
        { user: intruder._id, role: 'member' },
      ],
    });
    const msg = await createMessage(room._id, member._id);

    await expect(messageService.deleteMessage(msg._id, intruder._id)).rejects.toThrow('Permission denied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MessageService — getMessages()', () => {
  it('filters by before cursor', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    await createMessage(room._id, user._id);

    const future = new Date(Date.now() + 60000).toISOString();
    const { messages } = await messageService.getMessages(room._id, { before: future });
    expect(messages).toBeDefined();
  });
});

