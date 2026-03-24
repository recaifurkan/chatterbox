/**
 * Unit tests for User model methods
 */
const { connectDB, disconnectDB, clearDB, setTestEnv } = require('../../helpers/setup');
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

describe('User Model', () => {
  describe('password hashing', () => {
    it('hashes password before saving', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'plaintext123',
      });
      const raw = await User.findById(user._id).select('+password');
      expect(raw.password).not.toBe('plaintext123');
      expect(raw.password).toMatch(/^\$2[ab]\$/);
    });

    it('does not rehash password when other field is updated', async () => {
      const user = await User.create({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'mypassword',
      });
      const before = await User.findById(user._id).select('+password');
      const hashBefore = before.password;

      before.bio = 'Updated bio';
      await before.save();

      const after = await User.findById(user._id).select('+password');
      expect(after.password).toBe(hashBefore);
    });
  });

  describe('comparePassword', () => {
    it('returns true for correct password', async () => {
      const user = await User.create({
        username: 'pwtest',
        email: 'pw@test.com',
        password: 'correct123',
      });
      const found = await User.findById(user._id).select('+password');
      const result = await found.comparePassword('correct123');
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const user = await User.create({
        username: 'pwtest2',
        email: 'pw2@test.com',
        password: 'correct123',
      });
      const found = await User.findById(user._id).select('+password');
      const result = await found.comparePassword('wrong456');
      expect(result).toBe(false);
    });
  });

  describe('toPublicJSON', () => {
    it('excludes password field', async () => {
      const user = await User.create({
        username: 'pubtest',
        email: 'pub@test.com',
        password: 'secret',
      });
      const json = user.toPublicJSON();
      expect(json.password).toBeUndefined();
    });

    it('includes essential public fields', async () => {
      const user = await User.create({
        username: 'pubtest2',
        email: 'pub2@test.com',
        password: 'secret',
      });
      const json = user.toPublicJSON();
      expect(json._id).toBeDefined();
      expect(json.username).toBe('pubtest2');
      expect(json.email).toBe('pub2@test.com');
      expect(json.status).toBeDefined();
      expect(json.isOnline).toBeDefined();
    });

    it('does not include blockedUsers or mutedUsers', async () => {
      const user = await User.create({
        username: 'pubtest3',
        email: 'pub3@test.com',
        password: 'secret',
      });
      const json = user.toPublicJSON();
      expect(json.blockedUsers).toBeUndefined();
      expect(json.mutedUsers).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('rejects username shorter than 3 chars', async () => {
      await expect(
        User.create({ username: 'ab', email: 'x@y.com', password: 'pass123' })
      ).rejects.toThrow();
    });

    it('rejects invalid email format', async () => {
      await expect(
        User.create({ username: 'validuser', email: 'not-an-email', password: 'pass123' })
      ).rejects.toThrow();
    });

    it('rejects duplicate email', async () => {
      await User.create({ username: 'user1', email: 'dup@test.com', password: 'pass123' });
      await expect(
        User.create({ username: 'user2', email: 'dup@test.com', password: 'pass123' })
      ).rejects.toThrow();
    });

    it('rejects duplicate username', async () => {
      await User.create({ username: 'dupname', email: 'a@test.com', password: 'pass123' });
      await expect(
        User.create({ username: 'dupname', email: 'b@test.com', password: 'pass123' })
      ).rejects.toThrow();
    });
  });
});

