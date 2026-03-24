const {
  SOCKET_EVENTS, USER_STATUS, MESSAGE_TYPES, ROOM_TYPES, ROOM_ROLES, REDIS_KEYS, ALLOWED_MIME_TYPES,
} = require('../../../src/utils/constants');

describe('constants', () => {
  describe('SOCKET_EVENTS', () => {
    it('has required event names', () => {
      expect(SOCKET_EVENTS.SEND_MESSAGE).toBe('send_message');
      expect(SOCKET_EVENTS.NEW_MESSAGE).toBe('new_message');
      expect(SOCKET_EVENTS.ERROR).toBe('error');
      expect(SOCKET_EVENTS.JOIN_ROOM).toBe('join_room');
      expect(SOCKET_EVENTS.TYPING_START).toBe('typing_start');
    });
  });

  describe('USER_STATUS', () => {
    it('has all presence states', () => {
      expect(Object.values(USER_STATUS)).toEqual(
        expect.arrayContaining(['online', 'offline', 'busy', 'idle'])
      );
    });
  });

  describe('MESSAGE_TYPES', () => {
    it('includes text, image, video, file, system', () => {
      expect(Object.values(MESSAGE_TYPES)).toEqual(
        expect.arrayContaining(['text', 'image', 'video', 'file', 'system'])
      );
    });
  });

  describe('ROOM_TYPES', () => {
    it('has public, private, dm', () => {
      expect(ROOM_TYPES.PUBLIC).toBe('public');
      expect(ROOM_TYPES.PRIVATE).toBe('private');
      expect(ROOM_TYPES.DM).toBe('dm');
    });
  });

  describe('ROOM_ROLES', () => {
    it('has owner, admin, moderator, member', () => {
      expect(Object.values(ROOM_ROLES)).toEqual(
        expect.arrayContaining(['owner', 'admin', 'moderator', 'member'])
      );
    });
  });

  describe('REDIS_KEYS', () => {
    it('generates correct refresh token key', () => {
      expect(REDIS_KEYS.REFRESH_TOKEN('user123')).toBe('refresh:user123');
    });

    it('generates correct blacklist key', () => {
      expect(REDIS_KEYS.BLACKLISTED_TOKEN('jti-abc')).toBe('blacklist:jti-abc');
    });

    it('generates correct presence key', () => {
      expect(REDIS_KEYS.USER_PRESENCE('user456')).toBe('presence:user456');
    });

    it('generates correct typing key', () => {
      expect(REDIS_KEYS.TYPING('room1', 'user1')).toBe('typing:room1:user1');
    });
  });

  describe('ALLOWED_MIME_TYPES', () => {
    it('allows common image types', () => {
      expect(ALLOWED_MIME_TYPES['image/jpeg']).toBe('.jpg');
      expect(ALLOWED_MIME_TYPES['image/png']).toBe('.png');
    });

    it('allows pdf and zip', () => {
      expect(ALLOWED_MIME_TYPES['application/pdf']).toBe('.pdf');
      expect(ALLOWED_MIME_TYPES['application/zip']).toBe('.zip');
    });
  });
});

