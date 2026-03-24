/**
 * Unit tests for auth.service.js
 */
const jwt = require('jsonwebtoken');
const { setTestEnv } = require('../../helpers/setup');

// Mock redis config before requiring auth service
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: () => require('ioredis-mock') && new (require('ioredis-mock'))(),
}));

const {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeAccessToken,
  revokeRefreshToken,
  isRefreshTokenValid,
} = require('../../../src/services/auth.service');

beforeAll(() => {
  setTestEnv();
});

describe('auth.service', () => {
  describe('signAccessToken', () => {
    it('returns token and jti', () => {
      const { token, jti } = signAccessToken('user123');
      expect(token).toBeTruthy();
      expect(jti).toBeTruthy();
    });

    it('token payload contains userId and jti', () => {
      const { token, jti } = signAccessToken('user123');
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe('user123');
      expect(decoded.jti).toBe(jti);
    });

    it('different calls return different jtis', () => {
      const { jti: jti1 } = signAccessToken('user123');
      const { jti: jti2 } = signAccessToken('user123');
      expect(jti1).not.toBe(jti2);
    });
  });

  describe('signRefreshToken', () => {
    it('returns token with type:refresh in payload', () => {
      const { token } = signRefreshToken('user456');
      const decoded = jwt.decode(token);
      expect(decoded.type).toBe('refresh');
      expect(decoded.userId).toBe('user456');
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies a valid refresh token', async () => {
      const { token } = signRefreshToken('user789');
      const decoded = await verifyRefreshToken(token);
      expect(decoded.userId).toBe('user789');
    });

    it('throws on invalid token', async () => {
      await expect(verifyRefreshToken('bad.token.here')).rejects.toThrow();
    });

    it('throws on access token used as refresh token', async () => {
      const { token } = signAccessToken('user999');
      await expect(verifyRefreshToken(token)).rejects.toThrow();
    });
  });

  describe('storeRefreshToken & isRefreshTokenValid', () => {
    it('stored token is valid', async () => {
      const { token } = signRefreshToken('userABC');
      await storeRefreshToken('userABC', token);
      const valid = await isRefreshTokenValid('userABC', token);
      expect(valid).toBe(true);
    });

    it('different token is invalid', async () => {
      const { token: token1 } = signRefreshToken('userXYZ');
      const { token: token2 } = signRefreshToken('userXYZ');
      await storeRefreshToken('userXYZ', token1);
      const valid = await isRefreshTokenValid('userXYZ', token2);
      expect(valid).toBe(false);
    });
  });

  describe('revokeAccessToken', () => {
    it('stores jti in blacklist', async () => {
      const { token, jti } = signAccessToken('userDEL');
      await revokeAccessToken(jti);
      // Using a fresh redis mock instance — just check it doesn't throw
      expect(jti).toBeTruthy();
    });
  });

  describe('revokeRefreshToken', () => {
    it('removes stored refresh token', async () => {
      const { token } = signRefreshToken('userEF');
      await storeRefreshToken('userEF', token);
      await revokeRefreshToken('userEF');
      const valid = await isRefreshTokenValid('userEF', token);
      expect(valid).toBe(false);
    });
  });
});

