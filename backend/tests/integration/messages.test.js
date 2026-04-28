/**
 * Integration tests for Message routes
 */
const request = require('supertest');
const mongoose = require('mongoose');
const {
  connectDB, disconnectDB, clearDB, setTestEnv,
  makeAccessToken, createUser, createRoom, createMessage,
} = require('../helpers/setup');

let mockRedisInstance;
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => mockRedisInstance,
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/storage/minio.provider', () => {
  return jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn().mockResolvedValue('/api/v1/files/test/file.jpg'),
    getStream: jest.fn().mockResolvedValue({ stream: null, contentType: 'application/octet-stream', size: 0 }),
    delete: jest.fn().mockResolvedValue(undefined),
    extractObjectName: jest.fn().mockReturnValue(null),
  }));
});
jest.mock('../../src/config/socket', () => ({
  getIO: () => ({ emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) }),
  initSocket: jest.fn(),
}));

const app = require('../../src/app');

beforeAll(async () => {
  setTestEnv();
  const RedisMock = require('ioredis-mock');
  mockRedisInstance = new RedisMock();
  await connectDB();
});

afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  await mockRedisInstance.flushall();
});

describe('GET /api/v1/messages/room/:roomId', () => {
  it('returns messages for a room (200)', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    await createMessage(room._id, user._id, { content: 'Hello world' });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .get(`/api/v1/messages/room/${room._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 without token', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const res = await request(app).get(`/api/v1/messages/room/${room._id}`);
    expect(res.status).toBe(401);
  });

  it('respects pagination (limit param)', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    for (let i = 0; i < 5; i++) {
      await createMessage(room._id, user._id, { content: `Message ${i}` });
    }
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .get(`/api/v1/messages/room/${room._id}?limit=3`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(3);
  });
});

describe('PUT /api/v1/messages/:id', () => {
  it('allows sender to edit their message', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id, { content: 'Original' });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .put(`/api/v1/messages/${msg._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Edited content' });

    expect(res.status).toBe(200);
    expect(res.body.data.message.isEdited).toBe(true);
  });

  it('returns 403 for another user trying to edit', async () => {
    const owner = await createUser();
    const other = await createUser();
    const room = await createRoom(owner._id, {
      members: [{ user: owner._id, role: 'owner' }, { user: other._id, role: 'member' }],
    });
    const msg = await createMessage(room._id, owner._id);
    const token = makeAccessToken(other._id);

    const res = await request(app)
      .put(`/api/v1/messages/${msg._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/messages/:id', () => {
  it('allows sender to delete their message', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .delete(`/api/v1/messages/${msg._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('allows room admin to delete any message', async () => {
    const admin = await createUser();
    const member = await createUser();
    const room = await createRoom(admin._id, {
      members: [{ user: admin._id, role: 'owner' }, { user: member._id, role: 'member' }],
    });
    const msg = await createMessage(room._id, member._id);
    const token = makeAccessToken(admin._id);

    const res = await request(app)
      .delete(`/api/v1/messages/${msg._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 403 when a regular member tries to delete others message', async () => {
    const owner = await createUser();
    const member1 = await createUser();
    const member2 = await createUser();
    const room = await createRoom(owner._id, {
      members: [
        { user: owner._id, role: 'owner' },
        { user: member1._id, role: 'member' },
        { user: member2._id, role: 'member' },
      ],
    });
    const msg = await createMessage(room._id, member1._id);
    const token = makeAccessToken(member2._id);

    const res = await request(app)
      .delete(`/api/v1/messages/${msg._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/messages/:id/reactions', () => {
  it('adds a reaction to a message', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .post(`/api/v1/messages/${msg._id}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' });

    expect(res.status).toBe(200);
    expect(res.body.data.reactions[0].emoji).toBe('👍');
  });

  it('returns 409 on duplicate reaction from same user', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    const token = makeAccessToken(user._id);

    await request(app)
      .post(`/api/v1/messages/${msg._id}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '❤️' });

    const res = await request(app)
      .post(`/api/v1/messages/${msg._id}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '❤️' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/v1/messages/:id/reactions/:emoji', () => {
  it('removes a reaction', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id, {
      reactions: [{ emoji: '🎉', users: [user._id], count: 1 }],
    });
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .delete(`/api/v1/messages/${msg._id}/reactions/${encodeURIComponent('🎉')}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/messages/:id/audit', () => {
  it('returns audit log for room member', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    const token = makeAccessToken(user._id);

    const AuditLog = require('../../src/models/AuditLog');
    await AuditLog.create({
      messageId: msg._id,
      roomId: room._id,
      action: 'edit',
      actorId: user._id,
      before: { content: 'old' },
      after: { content: 'new' },
    });

    const res = await request(app)
      .get(`/api/v1/messages/${msg._id}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.logs)).toBe(true);
  });

  it('returns 403 for non-member', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id);
    const msg = await createMessage(room._id, owner._id);
    const token = makeAccessToken(stranger._id);

    const res = await request(app)
      .get(`/api/v1/messages/${msg._id}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/messages/room/:roomId/read', () => {
  it('marks messages as read', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const msg = await createMessage(room._id, user._id);
    const token = makeAccessToken(user._id);

    const res = await request(app)
      .post(`/api/v1/messages/room/${room._id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .send({ messageIds: [msg._id] });

    expect(res.status).toBe(200);
  });
});

