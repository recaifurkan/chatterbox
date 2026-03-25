const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Rooms
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  USER_JOINED_ROOM: 'user_joined_room',
  USER_LEFT_ROOM: 'user_left_room',

  // Messages
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  EDIT_MESSAGE: 'edit_message',
  MESSAGE_EDITED: 'message_edited',
  DELETE_MESSAGE: 'delete_message',
  MESSAGE_DELETED: 'message_deleted',

  // Direct Messages
  SEND_DM: 'send_dm',
  NEW_DM: 'new_dm',

  // Typing
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  USER_TYPING: 'user_typing',
  USER_STOP_TYPING: 'user_stop_typing',

  // Presence
  USER_STATUS_CHANGE: 'user_status_change',
  SET_STATUS: 'set_status',

  // Reactions
  ADD_REACTION: 'add_reaction',
  REMOVE_REACTION: 'remove_reaction',
  REACTION_UPDATED: 'reaction_updated',

  // Read receipts
  MARK_READ: 'mark_read',
  MESSAGES_READ: 'messages_read',

  // Notifications
  NEW_NOTIFICATION: 'new_notification',

  // Calls (LiveKit signaling — sinyal yalnızca Socket.IO üzerinden)
  CALL_INITIATE: 'call_initiate',
  CALL_INCOMING: 'call_incoming',
  CALL_ACCEPT: 'call_accept',
  CALL_REJECT: 'call_reject',
  CALL_END: 'call_end',
  CALL_BUSY: 'call_busy',

  // Errors
  ERROR: 'error',
};

const USER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  IDLE: 'idle',
};

const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
  SYSTEM: 'system',
};

const ROOM_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  DM: 'dm',
};

const ROOM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
};

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'text/plain': '.txt',
};

const REDIS_KEYS = {
  REFRESH_TOKEN: (userId) => `refresh:${userId}`,
  BLACKLISTED_TOKEN: (jti) => `blacklist:${jti}`,
  USER_PRESENCE: (userId) => `presence:${userId}`,
  TYPING: (roomId, userId) => `typing:${roomId}:${userId}`,
  ROOM_MESSAGES_CACHE: (roomId) => `room:messages:${roomId}`,
  USER_SOCKET: (userId) => `socket:user:${userId}`,
  CALL_ACTIVE: (callId) => `call:active:${callId}`,
  CALL_USER: (userId) => `call:user:${userId}`,
};

module.exports = {
  SOCKET_EVENTS,
  USER_STATUS,
  MESSAGE_TYPES,
  ROOM_TYPES,
  ROOM_ROLES,
  ALLOWED_MIME_TYPES,
  REDIS_KEYS,
};

