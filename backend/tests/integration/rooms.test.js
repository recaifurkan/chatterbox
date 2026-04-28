/**
 * Integration tests for Room routes
 */
const request = require('supertest');
const {
  connectDB, disconnectDB, clearDB, setTestEnv,
  makeAccessToken, createUser, createRoom,
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

describe('GET /api/v1/rooms', () => {
  it('returns public rooms list (200)', async () => {
    const user = await createUser();
    await createRoom(user._id, { name: 'Public Room', type: 'public' });
    const token = makeAccessToken(user._id);
    const res = await request(app).get('/api/v1/rooms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.rooms)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/rooms');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/rooms/my', () => {
  it('returns rooms the user belongs to', async () => {
    const user = await createUser();
    await createRoom(user._id, { name: 'My Room' });
    const token = makeAccessToken(user._id);
    const res = await request(app).get('/api/v1/rooms/my').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rooms.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/v1/rooms', () => {
  it('creates a public room (201)', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Room', type: 'public' });
    expect(res.status).toBe(201);
    expect(res.body.data.room.name).toBe('New Room');
  });

  it('creates a private room with inviteCode', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Secret Room', type: 'private' });
    expect(res.status).toBe(201);
    expect(res.body.data.room.inviteCode).toBeTruthy();
  });
});

describe('GET /api/v1/rooms/:id', () => {
  it('returns public room details', async () => {
    const user = await createUser();
    const room = await createRoom(user._id, { type: 'public' });
    const token = makeAccessToken(user._id);
    const res = await request(app).get(`/api/v1/rooms/${room._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.room._id).toBe(room._id.toString());
  });

  it('returns 403 for private room if not a member', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id, { type: 'private' });
    const token = makeAccessToken(stranger._id);
    const res = await request(app).get(`/api/v1/rooms/${room._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent room', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const mongoose = require('mongoose');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/v1/rooms/${fakeId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/rooms/:id', () => {
  it('allows owner to update room', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .put(`/api/v1/rooms/${room._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.room.name).toBe('Updated Name');
  });

  it('returns 403 for non-admin member', async () => {
    const owner = await createUser();
    const member = await createUser();
    const room = await createRoom(owner._id, {
      members: [{ user: owner._id, role: 'owner' }, { user: member._id, role: 'member' }],
    });
    const token = makeAccessToken(member._id);
    const res = await request(app)
      .put(`/api/v1/rooms/${room._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/rooms/:id', () => {
  it('allows owner to delete room', async () => {
    const user = await createUser();
    const room = await createRoom(user._id);
    const token = makeAccessToken(user._id);
    const res = await request(app).delete(`/api/v1/rooms/${room._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-owner', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id);
    const token = makeAccessToken(stranger._id);
    const res = await request(app).delete(`/api/v1/rooms/${room._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/rooms/:id/join', () => {
  it('allows joining a public room', async () => {
    const owner = await createUser();
    const joiner = await createUser();
    const room = await createRoom(owner._id, { type: 'public' });
    const token = makeAccessToken(joiner._id);
    const res = await request(app).post(`/api/v1/rooms/${room._id}/join`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('requires invite code for private room', async () => {
    const owner = await createUser();
    const joiner = await createUser();
    const room = await createRoom(owner._id, { type: 'private', inviteCode: 'secret123' });
    const token = makeAccessToken(joiner._id);
    const res = await request(app)
      .post(`/api/v1/rooms/${room._id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ inviteCode: 'wrongcode' });
    expect(res.status).toBe(403);
  });

  it('joins private room with correct invite code', async () => {
    const owner = await createUser();
    const joiner = await createUser();
    const room = await createRoom(owner._id, { type: 'private', inviteCode: 'correct-code' });
    const token = makeAccessToken(joiner._id);
    const res = await request(app)
      .post(`/api/v1/rooms/${room._id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ inviteCode: 'correct-code' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/rooms/:id/leave', () => {
  it('allows member to leave a room', async () => {
    const owner = await createUser();
    const member = await createUser();
    const room = await createRoom(owner._id, {
      members: [{ user: owner._id, role: 'owner' }, { user: member._id, role: 'member' }],
    });
    const token = makeAccessToken(member._id);
    const res = await request(app).post(`/api/v1/rooms/${room._id}/leave`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('prevents owner from leaving without transfer', async () => {
    const owner = await createUser();
    const room = await createRoom(owner._id);
    const token = makeAccessToken(owner._id);
    const res = await request(app).post(`/api/v1/rooms/${room._id}/leave`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/rooms/:id/members', () => {
  it('returns member list for public room', async () => {
    const user = await createUser();
    const room = await createRoom(user._id, { type: 'public' });
    const token = makeAccessToken(user._id);
    const res = await request(app).get(`/api/v1/rooms/${room._id}/members`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.members)).toBe(true);
  });

  it('denies member list for private room to non-members', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const room = await createRoom(owner._id, { type: 'private', inviteCode: 'abc' });
    const token = makeAccessToken(stranger._id);
    const res = await request(app).get(`/api/v1/rooms/${room._id}/members`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/rooms/:id/members/role', () => {
  it('rejects invalid role value', async () => {
    const owner = await createUser();
    const member = await createUser();
    const room = await createRoom(owner._id, {
      members: [{ user: owner._id, role: 'owner' }, { user: member._id, role: 'member' }],
    });
    const token = makeAccessToken(owner._id);
    const res = await request(app)
      .patch(`/api/v1/rooms/${room._id}/members/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: member._id.toString(), role: 'owner' }); // owner not allowed
    expect(res.status).toBe(400);
  });

  it('updates role to admin', async () => {
    const owner = await createUser();
    const member = await createUser();
    const room = await createRoom(owner._id, {
      members: [{ user: owner._id, role: 'owner' }, { user: member._id, role: 'member' }],
    });
    const token = makeAccessToken(owner._id);
    const res = await request(app)
      .patch(`/api/v1/rooms/${room._id}/members/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: member._id.toString(), role: 'admin' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/rooms/dm', () => {
  it('creates a DM room between two users', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const token = makeAccessToken(user1._id);
    const res = await request(app)
      .post('/api/v1/rooms/dm')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: user2._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.data.room.type).toBe('dm');
  });

  it('returns 400 when targeting self', async () => {
    const user = await createUser();
    const token = makeAccessToken(user._id);
    const res = await request(app)
      .post('/api/v1/rooms/dm')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: user._id.toString() });
    expect(res.status).toBe(400);
  });
});

