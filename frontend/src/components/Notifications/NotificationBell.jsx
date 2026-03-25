import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { notificationAPI } from '../../api/index.js';
import { useNotificationStore } from '../../store/notificationStore';
import { formatRelativeTime } from '../../utils/helpers';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, setNotifications, markRead, markAllRead } = useNotificationStore();
  const buttonRef = useRef(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Dışarı tıklama ve Escape ile kapat
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      // Button'a veya dropdown içine tıklanmadıysa kapat
      if (buttonRef.current?.contains(e.target)) return;
      if (e.target.closest('[data-notif-panel]')) return;
      setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

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

  // Button'un ekran pozisyonuna göre dropdown konumu hesapla
  function getDropdownStyle() {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      return { position: 'fixed', top: rect.bottom + 4, left: 12, right: 12 };
    }
    // Desktop: butonun altında, sola doğru açılır
    const left = Math.max(8, rect.left);
    const maxRight = window.innerWidth - 8;
    const width = 320;
    const adjustedLeft = left + width > maxRight ? maxRight - width : left;
    return { position: 'fixed', top: rect.bottom + 4, left: adjustedLeft, width };
  }

  return (
    <>
      <button
        ref={buttonRef}
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

      {/* Portal ile body'ye render — hiçbir stacking context'e takılmaz */}
      {open && createPortal(
        <>
          {/* Backdrop — tüm ekranlar için */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />

          {/* Dropdown panel */}
          <div
            data-notif-panel
            className="z-[9999] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
            style={getDropdownStyle()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="font-semibold text-white text-sm">Bildirimler</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Tümünü oku
                </button>
              )}
            </div>

            {/* Liste */}
            <div className="max-h-80 overflow-y-auto overscroll-contain">
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
                      notif.read ? '' : 'bg-blue-600/5'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{ICONS[notif.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-2 break-words">{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-gray-400 line-clamp-2 break-words mt-0.5">{notif.body}</p>
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
        </>,
        document.body
      )}
    </>
  );
}
