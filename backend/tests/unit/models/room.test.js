/**
 * Unit tests for Room model methods
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB, setTestEnv } = require('../../helpers/setup');
const Room = require('../../../src/models/Room');
const User = require('../../../src/models/User');

beforeAll(async () => {
  setTestEnv();
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});

afterEach(async () => {
  await clearDB();
});

let ownerId, memberId, strangerId;

beforeEach(async () => {
  const owner = await User.create({ username: 'owner', email: 'owner@test.com', password: 'pass123' });
  const member = await User.create({ username: 'member', email: 'member@test.com', password: 'pass123' });
  const stranger = await User.create({ username: 'stranger', email: 'stranger@test.com', password: 'pass123' });
  ownerId = owner._id;
  memberId = member._id;
  strangerId = stranger._id;
});

describe('Room Model', () => {
  describe('isMember', () => {
    it('returns true for a member', async () => {
      const room = await Room.create({
        name: 'Test Room',
        type: 'public',
        createdBy: ownerId,
        members: [
          { user: ownerId, role: 'owner' },
          { user: memberId, role: 'member' },
        ],
      });
      expect(room.isMember(memberId)).toBe(true);
    });

    it('returns false for a non-member', async () => {
      const room = await Room.create({
        name: 'Test Room',
        type: 'public',
        createdBy: ownerId,
        members: [{ user: ownerId, role: 'owner' }],
      });
      expect(room.isMember(strangerId)).toBe(false);
    });

    it('works with string ids', async () => {
      const room = await Room.create({
        name: 'Test Room',
        type: 'public',
        createdBy: ownerId,
        members: [{ user: ownerId, role: 'owner' }],
      });
      expect(room.isMember(ownerId.toString())).toBe(true);
    });
  });

  describe('hasRole', () => {
    let room;
    beforeEach(async () => {
      room = await Room.create({
        name: 'Role Room',
        type: 'public',
        createdBy: ownerId,
        members: [
          { user: ownerId, role: 'owner' },
          { user: memberId, role: 'admin' },
        ],
      });
    });

    it('returns true when user has the exact role (string)', () => {
      expect(room.hasRole(ownerId, 'owner')).toBe(true);
    });

    it('returns true when user role is in array', () => {
      expect(room.hasRole(memberId, ['owner', 'admin'])).toBe(true);
    });

    it('returns false when user role not in array', () => {
      expect(room.hasRole(memberId, ['owner', 'moderator'])).toBe(false);
    });

    it('returns false for non-member', () => {
      expect(room.hasRole(strangerId, ['owner', 'admin'])).toBe(false);
    });
  });

  describe('memberCount virtual', () => {
    it('returns correct member count', async () => {
      const room = await Room.create({
        name: 'Count Room',
        type: 'public',
        createdBy: ownerId,
        members: [
          { user: ownerId, role: 'owner' },
          { user: memberId, role: 'member' },
        ],
      });
      expect(room.memberCount).toBe(2);
    });
  });

  describe('validation', () => {
    it('rejects room name over 50 chars', async () => {
      await expect(
        Room.create({
          name: 'a'.repeat(51),
          type: 'public',
          createdBy: ownerId,
          members: [{ user: ownerId, role: 'owner' }],
        })
      ).rejects.toThrow();
    });

    it('rejects invalid room type', async () => {
      await expect(
        Room.create({
          name: 'Bad Room',
          type: 'invalid_type',
          createdBy: ownerId,
          members: [{ user: ownerId, role: 'owner' }],
        })
      ).rejects.toThrow();
    });
  });
});

