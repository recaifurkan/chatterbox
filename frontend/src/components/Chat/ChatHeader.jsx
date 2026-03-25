import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';

export default function ChatHeader({ room, onMembersClick, onSearchClick }) {
  const { toggleSidebar } = useUIStore();
  const { userPresence } = useChatStore();
  const { initiateCall, callStatus } = useCallStore();
  const { user } = useAuthStore();

  if (!room) return (
    <div className="flex-shrink-0 h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3 animate-pulse">
      <div className="w-8 h-8 bg-gray-700 rounded-lg" />
      <div className="w-32 h-4 bg-gray-700 rounded" />
    </div>
  );

  // Gerçek zamanlı online sayısı: önce Redis presence (userPresence store),
  // MongoDB isOnline alanına değil.
  const onlineCount = room.members?.filter((m) => {
    const uid = m.user?._id || m.user;
    const presence = userPresence[uid];
    if (presence) return presence.status !== 'offline' && presence.isOnline !== false;
    return m.user?.isOnline === true;
  }).length || 0;

  return (
    <div className="flex-shrink-0 h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3">
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Room icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center text-sm font-bold">
        {room.type === 'dm' ? '👤' : room.type === 'private' ? '🔒' : '#'}
      </div>

      {/* Room info */}
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-white text-sm truncate">{room.name}</h2>
        {room.type !== 'dm' && room.members && (
          <p className="text-xs text-gray-400">
            {room.members.length} üye
            {onlineCount > 0 && <span className="text-green-400"> · {onlineCount} çevrimiçi</span>}
          </p>
        )}
        {room.description && (
          <p className="text-xs text-gray-400 truncate hidden sm:block">{room.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Arama butonları — DM odalarında göster */}
        {room.type === 'dm' && callStatus === 'idle' && (() => {
          const targetMember = room.members?.find((m) => {
            const uid = m.user?._id || m.user;
            return uid !== user?._id;
          });
          const targetUserId = targetMember?.user?._id || targetMember?.user;
          const targetUserName = targetMember?.user?.username || room.name;
          return targetUserId ? (
            <>
              {/* Sesli arama */}
              <button
                onClick={() => initiateCall({ roomId: room._id, targetUserId, targetUserName, callType: 'audio' })}
                className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-gray-700 transition-colors"
                title="Sesli arama"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              {/* Görüntülü arama */}
              <button
                onClick={() => initiateCall({ roomId: room._id, targetUserId, targetUserName, callType: 'video' })}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                title="Görüntülü arama"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </>
          ) : null;
        })()}

        <button
          onClick={onSearchClick}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Mesajlarda ara"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        {room.type !== 'dm' && (
          <button
            onClick={onMembersClick}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Üyeler"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
