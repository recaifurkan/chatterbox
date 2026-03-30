import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useSocketStore } from '../../store/socketStore';
import { ROOM_TYPES } from '../../utils/constants';
import RoomList from './RoomList';
import Avatar from '../UI/Avatar';
import StatusBadge from '../User/StatusBadge';
import NotificationBell from '../Notifications/NotificationBell';
import LanguageSwitcher from '../UI/LanguageSwitcher';

export default function Sidebar({ onRoomSelect }) {
  const { user, logout } = useAuthStore();
  const { rooms, activeRoomId, setActiveRoom, unreadCounts, userPresence } = useChatStore();
  const { openModal, toggleSearch, activeSidebarTab, setSidebarTab } = useUIStore();
  const { emit } = useSocketStore();

  const publicRooms = rooms.filter((r) => r.type !== ROOM_TYPES.DM);
  const dmRooms = rooms.filter((r) => r.type === ROOM_TYPES.DM);

  function handleRoomClick(roomId) {
    // Oda değiştirirken leave_room emit ETMİYORUZ.
    // Kullanıcı tüm odalarının socket room'unda kalarak
    // mesaj ve bildirim almaya devam eder.
    // Presence handler zaten connect'te tüm odalara join eder.
    setActiveRoom(roomId);
    emit('join_room', { roomId });
    onRoomSelect?.();
  }

  return (
    <div className="w-72 h-full bg-gray-800 flex flex-col border-r border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg">Chatterbox</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={toggleSearch}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Mesajlarda ara"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-3 pt-3 gap-1">
        <button
          onClick={() => setSidebarTab('rooms')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeSidebarTab === 'rooms' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Odalar
        </button>
        <button
          onClick={() => setSidebarTab('dms')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeSidebarTab === 'dms' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Mesajlar
          {dmRooms.reduce((s, r) => s + (unreadCounts[r._id] || 0), 0) > 0 && (
            <span className="ml-1.5 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
              {dmRooms.reduce((s, r) => s + (unreadCounts[r._id] || 0), 0)}
            </span>
          )}
        </button>
      </div>

      {/* Odaları Keşfet butonu */}
      {activeSidebarTab === 'rooms' && (
        <div className="px-3 pt-2">
          <button
            onClick={() => openModal('browseRooms')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:text-blue-300 text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Odaları Keşfet
          </button>
        </div>
      )}

      {/* Room/DM list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {activeSidebarTab === 'rooms' ? (
          <RoomList
            rooms={publicRooms}
            activeRoomId={activeRoomId}
            unreadCounts={unreadCounts}
            onRoomClick={handleRoomClick}
            onCreateRoom={() => openModal('createRoom')}
          />
        ) : (
          <DMList
            rooms={dmRooms}
            activeRoomId={activeRoomId}
            unreadCounts={unreadCounts}
            currentUserId={user?._id}
            userPresence={userPresence}
            onRoomClick={handleRoomClick}
          />
        )}
      </div>

      {/* Current user footer */}
      <div className="px-3 py-3 border-t border-gray-700 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <Avatar user={user} size="sm" />
            <StatusBadge status={userPresence[user?._id]?.status || user?.status || 'online'} className="absolute -bottom-0.5 -right-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-gray-400 truncate">{user?.statusMessage || user?.email}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openModal('userProfile', { userId: user?._id, isSelf: true })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="Profil ayarları"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
              title="Çıkış yap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        <LanguageSwitcher />
      </div>
    </div>
  );
}

function DMList({ rooms, activeRoomId, unreadCounts, currentUserId, userPresence, onRoomClick }) {
  if (!rooms.length) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        <p>Henüz özel mesajınız yok</p>
        <p className="text-xs mt-1">Bir kullanıcıya tıklayarak DM başlatın</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {rooms.map((room) => {
        const other = room.members?.find((m) => (m.user?._id || m.user) !== currentUserId);
        const otherUser = other?.user;
        const otherUserId = otherUser?._id || other?.user;
        const presence = userPresence[otherUserId];
        const realTimeStatus = presence?.status || otherUser?.status || 'offline';
        const unread = unreadCounts[room._id] || 0;
        const isActive = activeRoomId === room._id;

        return (
          <button
            key={room._id}
            onClick={() => onRoomClick(room._id)}
            className={`sidebar-item w-full text-left ${isActive ? 'active' : ''}`}
          >
            <div className="relative flex-shrink-0">
              <Avatar user={otherUser} size="sm" />
              <StatusBadge
                status={realTimeStatus}
                className="absolute -bottom-0.5 -right-0.5"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {typeof otherUser === 'object' ? otherUser?.username : 'Kullanıcı'}
              </p>
            </div>
            {unread > 0 && (
              <span className="flex-shrink-0 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
