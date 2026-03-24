import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  rooms: [],
  dmRooms: [],
  messages: {},       // { [roomId]: Message[] }
  activeRoomId: null,
  typingUsers: {},    // { [roomId]: { [userId]: username } }
  userPresence: {},   // { [userId]: { status, isOnline, lastSeen } }
  unreadCounts: {},   // { [roomId]: number }
  messagePagination: {}, // { [roomId]: { hasMore, loading } }

  setRooms: (rooms) => set({ rooms }),
  setDmRooms: (dmRooms) => set({ dmRooms }),

  addOrUpdateRoom: (room) => {
    set((state) => {
      const isExisting = state.rooms.find((r) => r._id === room._id);
      if (isExisting) {
        return { rooms: state.rooms.map((r) => (r._id === room._id ? { ...r, ...room } : r)) };
      }
      return { rooms: [room, ...state.rooms] };
    });
  },

  setActiveRoom: (roomId) => {
    set({ activeRoomId: roomId });
    // Clear unread
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [roomId]: 0 } }));
  },

  setMessages: (roomId, messages) =>
    set((state) => ({ messages: { ...state.messages, [roomId]: messages } })),

  addMessage: (roomId, message) => {
    set((state) => {
      const existing = state.messages[roomId] || [];
      // Avoid duplicates
      if (existing.find((m) => m._id === message._id)) return {};
      const updated = [...existing, message];
      // Update unread count if not in active room
      const unreadCounts = { ...state.unreadCounts };
      if (state.activeRoomId !== roomId) {
        unreadCounts[roomId] = (unreadCounts[roomId] || 0) + 1;
      }
      return {
        messages: { ...state.messages, [roomId]: updated },
        unreadCounts,
      };
    });
  },

  prependMessages: (roomId, newMessages) => {
    set((state) => {
      const existing = state.messages[roomId] || [];
      return { messages: { ...state.messages, [roomId]: [...newMessages, ...existing] } };
    });
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      const newMessages = { ...state.messages };
      for (const roomId in newMessages) {
        const idx = newMessages[roomId].findIndex((m) => m._id === messageId);
        if (idx !== -1) {
          const arr = [...newMessages[roomId]];
          arr[idx] = { ...arr[idx], ...updates };
          newMessages[roomId] = arr;
          break;
        }
      }
      return { messages: newMessages };
    });
  },

  markMessagesRead: (messageId, readBy) => {
    get().updateMessage(messageId, (msg) => ({
      readBy: [...(msg.readBy || []), readBy],
    }));
  },

  setTyping: (roomId, userId, username) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [roomId]: { ...(state.typingUsers[roomId] || {}), [userId]: username },
      },
    }));
  },

  clearTyping: (roomId, userId) => {
    set((state) => {
      const room = { ...(state.typingUsers[roomId] || {}) };
      delete room[userId];
      return { typingUsers: { ...state.typingUsers, [roomId]: room } };
    });
  },

  updateUserPresence: (userId, presence) => {
    set((state) => ({
      userPresence: { ...state.userPresence, [userId]: { ...(state.userPresence[userId] || {}), ...presence } },
    }));
  },

  addMemberToRoom: (roomId, user) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r._id === roomId
          ? { ...r, members: [...(r.members || []), { user, role: 'member', joinedAt: new Date() }] }
          : r
      ),
    }));
  },

  removeMemberFromRoom: (roomId, userId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r._id === roomId
          ? { ...r, members: (r.members || []).filter((m) => (m.user?._id || m.user) !== userId) }
          : r
      ),
    }));
  },

  setMessagePagination: (roomId, data) => {
    set((state) => ({
      messagePagination: { ...state.messagePagination, [roomId]: { ...(state.messagePagination[roomId] || {}), ...data } },
    }));
  },

  reset: () => set({ rooms: [], dmRooms: [], messages: {}, activeRoomId: null, typingUsers: {}, unreadCounts: {} }),
}));

