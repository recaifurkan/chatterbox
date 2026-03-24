export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  USER_JOINED_ROOM: 'user_joined_room',
  USER_LEFT_ROOM: 'user_left_room',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  EDIT_MESSAGE: 'edit_message',
  MESSAGE_EDITED: 'message_edited',
  DELETE_MESSAGE: 'delete_message',
  MESSAGE_DELETED: 'message_deleted',
  SEND_DM: 'send_dm',
  NEW_DM: 'new_dm',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  USER_TYPING: 'user_typing',
  USER_STOP_TYPING: 'user_stop_typing',
  USER_STATUS_CHANGE: 'user_status_change',
  SET_STATUS: 'set_status',
  ADD_REACTION: 'add_reaction',
  REMOVE_REACTION: 'remove_reaction',
  REACTION_UPDATED: 'reaction_updated',
  MARK_READ: 'mark_read',
  MESSAGES_READ: 'messages_read',
  NEW_NOTIFICATION: 'new_notification',
  ERROR: 'error',
};

export const USER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  IDLE: 'idle',
};

export const ROOM_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  DM: 'dm',
};

