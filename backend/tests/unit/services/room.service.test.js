/**
 * Unit tests for RoomService — missing coverage paths
 */
const { connectDB, disconnectDB, clearDB, createUser, createRoom } = require('../../helpers/setup');
const RoomService = require('../../../src/services/room.service');
const Room = require('../../../src/models/Room');
const User = require('../../../src/models/User');
const Message = require('../../../src/models/Message');
const { ROOM_TYPES, ROOM_ROLES } = require('../../../src/utils/constants');

let roomService;

beforeAll(async () => { await connectDB(); });
afterAll(async () => { await disconnectDB(); });
afterEach(async () => { await clearDB(); });

beforeEach(() => {
  roomService = new RoomService({ Room, User, Message });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RoomService — createRoom()', () => {
  it('filters out creator from memberIds to avoid duplicates', async () => {
    const creator = await createUser();
    const other = await createUser();
    const creatorId = creator._id.toString();

    const { room } = await roomService.createRoom(
      { name: 'test-room', memberIds: [creatorId, other._id.toString()] },
      creator._id,
    );

    // Creator should appear only once (as OWNER)
    const ownerEntries = room.members.filter(
      (m) => m.user.toString() === creatorId && m.role === ROOM_ROLES.OWNER,
    );
    expect(ownerEntries).toHaveLength(1);
    expect(room.members).toHaveLength(2); // owner + other
  });

  it('generates inviteCode for private rooms', async () => {
    const creator = await createUser();
    const { room } = await roomService.createRoom(
      { name: 'private-room', type: ROOM_TYPES.PRIVATE },
      creator._id,
    );
    expect(room.inviteCode).toBeDefined();
    expect(typeof room.inviteCode).toBe('string');
  });

  it('does not generate inviteCode for public rooms', async () => {
    const creator = await createUser();
    const { room } = await roomService.createRoom(
      { name: 'public-room', type: ROOM_TYPES.PUBLIC },
      creator._id,
    );
    expect(room.inviteCode).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RoomService — joinRoom()', () => {
  it('returns alreadyMember: true when user is already a member', async () => {
    const creator = await createUser();
    const dbRoom = await createRoom(creator._id);

    const { room, alreadyMember } = await roomService.joinRoom(
      dbRoom._id, creator._id,
    );

    expect(alreadyMember).toBe(true);
    expect(room).toBeDefined();
  });

  it('throws ForbiddenError when joining a DM room', async () => {
    const creator = await createUser();
    const other = await createUser();
    const dmRoom = await createRoom(creator._id, {
      type: ROOM_TYPES.DM,
      members: [
        { user: creator._id, role: ROOM_ROLES.MEMBER },
        { user: other._id, role: ROOM_ROLES.MEMBER },
      ],
    });

    const newUser = await createUser();
    await expect(roomService.joinRoom(dmRoom._id, newUser._id)).rejects.toThrow('Cannot join DM rooms');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RoomService — promoteUser()', () => {
  it('throws BadRequestError for invalid role', async () => {
    const creator = await createUser();
    const member = await createUser();
    const dbRoom = await createRoom(creator._id, {
      members: [
        { user: creator._id, role: ROOM_ROLES.OWNER },
        { user: member._id, role: ROOM_ROLES.MEMBER },
      ],
    });

    await expect(
      roomService.promoteUser(dbRoom._id, creator._id, member._id.toString(), 'superadmin'),
    ).rejects.toThrow('Invalid role');
  });

  it('throws NotFoundError when target user is not a member', async () => {
    const creator = await createUser();
    const outsider = await createUser();
    const dbRoom = await createRoom(creator._id);

    await expect(
      roomService.promoteUser(dbRoom._id, creator._id, outsider._id.toString(), ROOM_ROLES.ADMIN),
    ).rejects.toThrow('not a member');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RoomService — addMember()', () => {
  it('adds a new member to the room', async () => {
    const creator = await createUser();
    const newMember = await createUser();
    const dbRoom = await createRoom(creator._id);

    const { members } = await roomService.addMember(dbRoom._id, creator._id, newMember._id.toString());
    const ids = members.map((m) => m.user._id.toString());
    expect(ids).toContain(newMember._id.toString());
  });

  it('throws ConflictError when user is already a member', async () => {
    const creator = await createUser();
    const dbRoom = await createRoom(creator._id);

    await expect(
      roomService.addMember(dbRoom._id, creator._id, creator._id.toString()),
    ).rejects.toThrow('zaten üye');
  });

  it('throws ForbiddenError when actor lacks permission', async () => {
    const creator = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const dbRoom = await createRoom(creator._id, {
      members: [
        { user: creator._id, role: ROOM_ROLES.OWNER },
        { user: member._id, role: ROOM_ROLES.MEMBER },
      ],
    });

    await expect(
      roomService.addMember(dbRoom._id, member._id, outsider._id.toString()),
    ).rejects.toThrow('yetkiniz yok');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RoomService — createOrGetDM()', () => {
  it('throws BadRequestError when trying to DM yourself', async () => {
    const user = await createUser();
    await expect(
      roomService.createOrGetDM(user._id, user._id.toString()),
    ).rejects.toThrow('Kendinize DM');
  });

  it('throws BadRequestError when targetUserId is missing', async () => {
    const user = await createUser();
    await expect(roomService.createOrGetDM(user._id, null)).rejects.toThrow('targetUserId gerekli');
  });

  it('throws NotFoundError when target user does not exist', async () => {
    const mongoose = require('mongoose');
    const user = await createUser();
    const fakeId = new mongoose.Types.ObjectId();
    await expect(roomService.createOrGetDM(user._id, fakeId.toString())).rejects.toThrow('bulunamadı');
  });

  it('throws ForbiddenError when target has blocked the caller', async () => {
    const user = await createUser();
    const blocker = await createUser({ blockedUsers: [] });
    // Manually add user to blocker's blockedUsers
    await User.findByIdAndUpdate(blocker._id, { $push: { blockedUsers: user._id } });
    const updatedBlocker = await User.findById(blocker._id);
    expect(updatedBlocker.blockedUsers).toHaveLength(1);

    await expect(
      roomService.createOrGetDM(user._id, blocker._id.toString()),
    ).rejects.toThrow('engelledi');
  });

  it('creates a new DM room when none exists', async () => {
    const user1 = await createUser();
    const user2 = await createUser();

    const { room } = await roomService.createOrGetDM(user1._id, user2._id.toString());
    expect(room.type).toBe(ROOM_TYPES.DM);
    expect(room.members).toHaveLength(2);
  });

  it('returns existing DM room when one already exists', async () => {
    const user1 = await createUser();
    const user2 = await createUser();

    const { room: first } = await roomService.createOrGetDM(user1._id, user2._id.toString());
    const { room: second } = await roomService.createOrGetDM(user1._id, user2._id.toString());

    expect(first._id.toString()).toBe(second._id.toString());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RoomService — getRoomMembers()', () => {
  it('throws ForbiddenError for private room when user is not a member', async () => {
    const creator = await createUser();
    const outsider = await createUser();
    const dbRoom = await Room.create({
      name: 'private-only',
      type: ROOM_TYPES.PRIVATE,
      createdBy: creator._id,
      inviteCode: 'secret123',
      members: [{ user: creator._id, role: ROOM_ROLES.OWNER }],
    });

    await expect(
      roomService.getRoomMembers(dbRoom._id, outsider._id),
    ).rejects.toThrow('Access denied');
  });
});

