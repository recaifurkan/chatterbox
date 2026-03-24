import { create } from 'zustand';

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    const unread = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount: unread });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  remove: (id) => {
    set((state) => {
      const notif = state.notifications.find((n) => n._id === id);
      return {
        notifications: state.notifications.filter((n) => n._id !== id),
        unreadCount: notif && !notif.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },
}));

