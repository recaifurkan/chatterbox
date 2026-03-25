/**
 * Unit tests for presence.service.js
 */
const { setTestEnv } = require('../../helpers/setup');

let mockRedisClient;

beforeAll(() => {
  setTestEnv();
  const RedisMock = require('ioredis-mock');
  mockRedisClient = new RedisMock();
});

beforeEach(async () => {
  await mockRedisClient.flushall();
});

const PresenceService = require('../../../src/services/presence.service');
const presenceService = new PresenceService({ getRedisClient: () => mockRedisClient });

const setUserOnline = presenceService.setUserOnline.bind(presenceService);
const setUserOffline = presenceService.setUserOffline.bind(presenceService);
const setUserStatus = presenceService.setUserStatus.bind(presenceService);
const getUserPresence = presenceService.getUserPresence.bind(presenceService);
const getUsersPresence = presenceService.getUsersPresence.bind(presenceService);
const setTyping = presenceService.setTyping.bind(presenceService);
const clearTyping = presenceService.clearTyping.bind(presenceService);
const getTypingUsers = presenceService.getTypingUsers.bind(presenceService);

describe('presence.service', () => {
  describe('setUserOnline', () => {
    it('stores ONLINE status with socketId in Redis', async () => {
      await setUserOnline('user1', 'socket-abc');
      const data = await mockRedisClient.hgetall('presence:user1');
      expect(data.status).toBe('online');
      expect(data.socketId).toBe('socket-abc');
      expect(data.lastSeen).toBeTruthy();
    });
  });

  describe('setUserOffline', () => {
    it('stores OFFLINE status in Redis', async () => {
      await setUserOnline('user2', 'socket-xyz');
      await setUserOffline('user2');
      const data = await mockRedisClient.hgetall('presence:user2');
      expect(data.status).toBe('offline');
      expect(data.socketId).toBe('');
    });
  });

  describe('setUserStatus', () => {
    it('updates status without clearing other fields', async () => {
      await setUserOnline('user3', 'socket-zzz');
      await setUserStatus('user3', 'busy');
      const data = await mockRedisClient.hgetall('presence:user3');
      expect(data.status).toBe('busy');
      expect(data.socketId).toBe('socket-zzz');
    });
  });

  describe('getUserPresence', () => {
    it('returns OFFLINE for unknown user', async () => {
      const result = await getUserPresence('unknown-user');
      expect(result.status).toBe('offline');
      expect(result.lastSeen).toBeNull();
    });

    it('returns stored presence data', async () => {
      await setUserOnline('user4', 'socket-id');
      const result = await getUserPresence('user4');
      expect(result.status).toBe('online');
      expect(result.lastSeen).toBeInstanceOf(Date);
    });
  });

  describe('getUsersPresence', () => {
    it('returns map of userId to status', async () => {
      await setUserOnline('userA', 'sa');
      await setUserOffline('userB');
      const result = await getUsersPresence(['userA', 'userB']);
      expect(result.userA).toBe('online');
      expect(result.userB).toBe('offline');
    });

    it('returns OFFLINE for users not in Redis', async () => {
      const result = await getUsersPresence(['ghost-user']);
      expect(result['ghost-user']).toBe('offline');
    });
  });

  describe('setTyping / clearTyping / getTypingUsers', () => {
    it('records typing user', async () => {
      await setTyping('room1', 'userT', 'Alice', 10);
      const users = await getTypingUsers('room1');
      expect(users).toHaveLength(1);
      expect(users[0].userId).toBe('userT');
      expect(users[0].username).toBe('Alice');
    });

    it('removes typing user after clearTyping', async () => {
      await setTyping('room1', 'userU', 'Bob', 10);
      await clearTyping('room1', 'userU');
      const users = await getTypingUsers('room1');
      expect(users.find((u) => u.userId === 'userU')).toBeUndefined();
    });

    it('returns empty array when no typing users', async () => {
      const users = await getTypingUsers('empty-room');
      expect(users).toEqual([]);
    });
  });
});

