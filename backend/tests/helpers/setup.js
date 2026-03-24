/**
 * Test setup helpers — MongoMemoryServer, Redis mock, app bootstrap
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

let mongod;

// ─── Setup / Teardown ───────────────────────────────────────────────────────

async function connectDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { autoIndex: true });
  // Sync all model indexes so $text search and unique constraints work
  await Promise.all(
    Object.values(mongoose.models).map((m) => m.syncIndexes())
  );
}

async function disconnectDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// ─── Redis mock setup ────────────────────────────────────────────────────────

let _redisMock;

function getTestRedis() {
  if (!_redisMock) {
    const RedisMock = require('ioredis-mock');
    _redisMock = new RedisMock();
  }
  return _redisMock;
}

function resetTestRedis() {
  if (_redisMock) {
    _redisMock.flushall();
  }
}

// ─── Auth token helpers ──────────────────────────────────────────────────────

function makeAccessToken(userId, jti = uuidv4()) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-min-32-characters-long';
  return jwt.sign({ userId: userId.toString(), jti }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function makeRefreshToken(userId, jti = uuidv4()) {
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-min-32-chars';
  return jwt.sign({ userId: userId.toString(), jti, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// ─── Factory helpers ─────────────────────────────────────────────────────────

const User = require('../../src/models/User');
const Room = require('../../src/models/Room');
const Message = require('../../src/models/Message');

async function createUser(overrides = {}) {
  const defaults = {
    username: `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    email: `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@test.com`,
    password: 'Password123!',
    isActive: true,
  };
  return User.create({ ...defaults, ...overrides });
}

async function createRoom(creatorId, overrides = {}) {
  const defaults = {
    name: `room_${Date.now()}`,
    type: 'public',
    createdBy: creatorId,
    members: [{ user: creatorId, role: 'owner' }],
  };
  return Room.create({ ...defaults, ...overrides });
}

async function createMessage(roomId, senderId, overrides = {}) {
  const defaults = {
    roomId,
    senderId,
    content: 'Test message content',
    type: 'text',
  };
  return Message.create({ ...defaults, ...overrides });
}

// ─── Environment setup ───────────────────────────────────────────────────────

function setTestEnv() {
  process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-min-32-chars';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.NODE_ENV = 'test';
}

module.exports = {
  connectDB,
  disconnectDB,
  clearDB,
  getTestRedis,
  resetTestRedis,
  makeAccessToken,
  makeRefreshToken,
  createUser,
  createRoom,
  createMessage,
  setTestEnv,
};

