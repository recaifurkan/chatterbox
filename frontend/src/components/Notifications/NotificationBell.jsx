import { useState, useEffect, useRef } from 'react';
import { notificationAPI } from '../../api/index.js';
import { useNotificationStore } from '../../store/notificationStore';
import { formatRelativeTime } from '../../utils/helpers';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, setNotifications, markRead, markAllRead } = useNotificationStore();
  const containerRef = useRef(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    try {
      const { notifications: notifs } = await notificationAPI.getAll({ limit: 20 });
      setNotifications(notifs);
    } catch {}
  }

  async function handleMarkRead(id) {
    await notificationAPI.markRead(id);
    markRead(id);
  }

  async function handleMarkAllRead() {
    await notificationAPI.markAllRead();
    markAllRead();
  }

  const ICONS = {
    mention: '📢',
    dm: '💬',
    room_invite: '🚪',
    message: '🔔',
    system: 'ℹ️',
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white text-sm">Bildirimler</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Tümünü oku
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <p>Bildirim yok</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => (
                <button
                  key={notif._id}
                  onClick={() => handleMarkRead(notif._id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-700/50 transition-colors border-b border-gray-700/50 last:border-0 ${
                    !notif.read ? 'bg-blue-600/5' : ''
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{ICONS[notif.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                    {notif.body && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{notif.body}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                  {!notif.read && (
                    <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

