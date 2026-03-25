import { create } from 'zustand';
import { io } from 'socket.io-client';
import { useChatStore } from './chatStore';
import { useNotificationStore } from './notificationStore';
import { useAuthStore } from './authStore';
import { SOCKET_EVENTS } from '../utils/constants';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,

  connect: (token) => {
    const { socket } = get();
    if (socket?.connected) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },

      // ─── Sticky session gerektirmeden multi-node desteği ────────────────
      // Server'da transports: ['websocket'] ayarlı olduğu için client da
      // yalnızca WebSocket kullanmalı. Aksi takdirde bağlantı kurulmaz.
      //
      // WebSocket = kalıcı tek TCP bağlantısı:
      //   • Bağlantı nginx üzerinden herhangi bir backend node'a gider (least_conn).
      //   • Bağlantı bir kez kurulunca o node'da kalır (TCP seviyesinde kalıcı).
      //   • Mesaj gönderimi Redis Adapter ile diğer node'lardaki clientlara iletilir.
      //   • Yeniden bağlanmada farklı bir node'a düşebilir — sorun yok,
      //     presence.handler odaları otomatik yeniden join eder.
      transports: ['websocket'],

      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      set({ connected: true });
    });

    newSocket.on('disconnect', () => {
      set({ connected: false });
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      if (err.message === 'Token expired' || err.message === 'Token revoked') {
        useAuthStore.getState().logout();
      }
    });

    // Register all event handlers
    registerEventHandlers(newSocket);

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  emit: (event, data) => {
    const { socket } = get();
    if (socket?.connected) socket.emit(event, data);
  },
}));

function registerEventHandlers(socket) {
  const chat = () => useChatStore.getState();
  const notif = () => useNotificationStore.getState();

  // New message in a room
  socket.on(SOCKET_EVENTS.NEW_MESSAGE, ({ message }) => {
    chat().addMessage(message.roomId, message);
  });

  // Message edited
  socket.on(SOCKET_EVENTS.MESSAGE_EDITED, ({ messageId, content, isEdited }) => {
    chat().updateMessage(messageId, { content, isEdited });
  });

  // Message deleted
  socket.on(SOCKET_EVENTS.MESSAGE_DELETED, ({ messageId }) => {
    chat().updateMessage(messageId, { isDeleted: true, content: 'This message has been deleted' });
  });

  // New DM
  socket.on(SOCKET_EVENTS.NEW_DM, ({ room, message }) => {
    chat().addOrUpdateRoom(room);
    chat().addMessage(message.roomId, message);
  });

  // Typing indicators
  socket.on(SOCKET_EVENTS.USER_TYPING, ({ roomId, userId, username }) => {
    chat().setTyping(roomId, userId, username);
  });

  socket.on(SOCKET_EVENTS.USER_STOP_TYPING, ({ roomId, userId }) => {
    chat().clearTyping(roomId, userId);
  });

  // User status change
  socket.on(SOCKET_EVENTS.USER_STATUS_CHANGE, ({ userId, status, isOnline, lastSeen }) => {
    chat().updateUserPresence(userId, { status, isOnline, lastSeen });
  });

  // Reaction update
  socket.on(SOCKET_EVENTS.REACTION_UPDATED, ({ messageId, reactions }) => {
    chat().updateMessage(messageId, { reactions });
  });

  // Read receipts
  socket.on(SOCKET_EVENTS.MESSAGES_READ, ({ messageIds, readBy }) => {
    messageIds.forEach((id) => chat().markMessagesRead(id, readBy));
  });

  // Notification
  socket.on(SOCKET_EVENTS.NEW_NOTIFICATION, (data) => {
    console.log('[Socket] NEW_NOTIFICATION received:', data);
    const notification = data?.notification;
    if (notification && notification._id) {
      notif().addNotification(notification);
      // Browser notification
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(notification.title || 'Bildirim', { body: notification.body });
      }
    }
  });

  // User joined/left room
  socket.on(SOCKET_EVENTS.USER_JOINED_ROOM, ({ roomId, user }) => {
    chat().addMemberToRoom(roomId, user);
  });

  socket.on(SOCKET_EVENTS.USER_LEFT_ROOM, ({ roomId, userId }) => {
    chat().removeMemberFromRoom(roomId, userId);
  });
}

