/**
 * Unit tests for UserService — covering uncovered branches
 */
const { connectDB, disconnectDB, clearDB, createUser } = require('../../helpers/setup');
const UserService = require('../../../src/services/user.service');
const User = require('../../../src/models/User');

function makeFilesystemService(overrides = {}) {
  return {
    upload: jest.fn().mockResolvedValue('/api/v1/files/avatars/test.jpg'),
    delete: jest.fn().mockResolvedValue(undefined),
    extractObjectName: jest.fn().mockReturnValue('avatars/test.jpg'),
    ...overrides,
  };
}

function makeMediaService(overrides = {}) {
  return {
    processAvatar: jest.fn().mockResolvedValue(Buffer.from('jpeg-data')),
    ...overrides,
  };
}

function makePresenceService() {
  return {
    getUserPresence: jest.fn().mockResolvedValue({ isOnline: false }),
  };
}

function makeGetIO() {
  const emit = jest.fn();
  return () => ({ emit });
}

let userService;

beforeAll(async () => { await connectDB(); });
afterAll(async () => { await disconnectDB(); });
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
});

beforeEach(() => {
  userService = new UserService({
    User,
    presenceService: makePresenceService(),
    getIO: makeGetIO(),
    filesystemService: makeFilesystemService(),
    mediaService: makeMediaService(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UserService — uploadAvatar()', () => {
  it('throws BadRequestError when fileBuffer is null', async () => {
    const user = await createUser();
    await expect(userService.uploadAvatar(user._id, null)).rejects.toThrow('Dosya bulunamadı');
  });

  it('throws BadRequestError when processAvatar fails', async () => {
    const fs = makeFilesystemService();
    const media = makeMediaService({
      processAvatar: jest.fn().mockRejectedValue(new Error('unsupported format')),
    });
    const svc = new UserService({
      User, presenceService: makePresenceService(), getIO: makeGetIO(), filesystemService: fs, mediaService: media,
    });
    const user = await createUser();
    await expect(svc.uploadAvatar(user._id, Buffer.from('bad'))).rejects.toThrow('desteklenmiyor');
  });

  it('skips old avatar deletion when user has no avatar', async () => {
    const fs = makeFilesystemService();
    const svc = new UserService({
      User, presenceService: makePresenceService(), getIO: makeGetIO(), filesystemService: fs, mediaService: makeMediaService(),
    });

    // User starts with no avatarUrl
    const user = await createUser();
    expect(user.avatarUrl).toBeFalsy();

    await svc.uploadAvatar(user._id, Buffer.from('img-data'));
    expect(fs.delete).not.toHaveBeenCalled();
    expect(fs.upload).toHaveBeenCalledTimes(1);
  });

  it('deletes old avatar when user already has one', async () => {
    const oldUrl = '/api/v1/files/avatars/old.jpg';
    const user = await createUser({ avatarUrl: oldUrl });

    const fs = makeFilesystemService({ extractObjectName: jest.fn().mockReturnValue('avatars/old.jpg') });
    const svc = new UserService({
      User, presenceService: makePresenceService(), getIO: makeGetIO(), filesystemService: fs, mediaService: makeMediaService(),
    });

    await svc.uploadAvatar(user._id, Buffer.from('new-img'));
    expect(fs.extractObjectName).toHaveBeenCalledWith(oldUrl);
    expect(fs.delete).toHaveBeenCalledWith('avatars/old.jpg');
  });

  it('skips delete when extractObjectName returns null', async () => {
    const user = await createUser({ avatarUrl: '/some/url' });

    const fs = makeFilesystemService({ extractObjectName: jest.fn().mockReturnValue(null) });
    const svc = new UserService({
      User, presenceService: makePresenceService(), getIO: makeGetIO(), filesystemService: fs, mediaService: makeMediaService(),
    });

    await svc.uploadAvatar(user._id, Buffer.from('img'));
    expect(fs.delete).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UserService — blockUser() / unblockUser() / muteUser()', () => {
  it('throws BadRequestError when blocking yourself', async () => {
    const user = await createUser();
    await expect(userService.blockUser(user._id, user._id.toString())).rejects.toThrow('Cannot block yourself');
  });

  it('throws NotFoundError for non-existent target', async () => {
    const mongoose = require('mongoose');
    const user = await createUser();
    const fakeId = new mongoose.Types.ObjectId();
    await expect(userService.blockUser(user._id, fakeId.toString())).rejects.toThrow('User not found');
  });

  it('successfully blocks a user', async () => {
    const user = await createUser();
    const target = await createUser();
    await userService.blockUser(user._id, target._id.toString());
    const updated = await User.findById(user._id);
    expect(updated.blockedUsers.map((id) => id.toString())).toContain(target._id.toString());
  });

  it('successfully unblocks a user', async () => {
    const user = await createUser();
    const target = await createUser();
    await User.findByIdAndUpdate(user._id, { $push: { blockedUsers: target._id } });
    await userService.unblockUser(user._id, target._id.toString());
    const updated = await User.findById(user._id);
    expect(updated.blockedUsers.map((id) => id.toString())).not.toContain(target._id.toString());
  });

  it('successfully mutes a user', async () => {
    const user = await createUser();
    const target = await createUser();
    await userService.muteUser(user._id, target._id.toString());
    const updated = await User.findById(user._id);
    expect(updated.mutedUsers.map((id) => id.toString())).toContain(target._id.toString());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UserService — updateProfile()', () => {
  it('throws ConflictError when username is already taken', async () => {
    const user1 = await createUser({ username: 'existing_user_xyz' });
    const user2 = await createUser();
    await expect(
      userService.updateProfile(user2._id, { username: user1.username }),
    ).rejects.toThrow('already taken');
  });

  it('updates profile fields successfully', async () => {
    const user = await createUser();
    const { user: updated } = await userService.updateProfile(user._id, { bio: 'Hello there' });
    expect(updated.bio).toBe('Hello there');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('UserService — searchUsers()', () => {
  it('throws BadRequestError for short queries', async () => {
    await expect(userService.searchUsers('a', 'user-id')).rejects.toThrow('too short');
  });

  it('returns matching users', async () => {
    const user = await createUser({ username: 'searchable_user_test' });
    const other = await createUser();
    const { users } = await userService.searchUsers('searchable_user', other._id);
    expect(users.map((u) => u._id.toString())).toContain(user._id.toString());
  });
});

