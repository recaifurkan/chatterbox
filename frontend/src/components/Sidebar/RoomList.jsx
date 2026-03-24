import { useState } from 'react';
import { roomAPI } from '../../api/room.api';
import { useChatStore } from '../../store/chatStore';
import toast from 'react-hot-toast';

export default function RoomList({ rooms, activeRoomId, unreadCounts, onRoomClick, onCreateRoom }) {
  const [joining, setJoining] = useState(null);
  const { addOrUpdateRoom } = useChatStore();

  async function handleJoin(roomId) {
    setJoining(roomId);
    try {
      const room = await roomAPI.joinRoom(roomId);
      addOrUpdateRoom(room);
      onRoomClick(roomId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Odaya katılınamadı');
    } finally {
      setJoining(null);
    }
  }

  const joined = rooms.filter((r) => r.members?.some(() => true)); // all loaded rooms are joined

  return (
    <div>
      {/* Joined rooms */}
      <div className="flex items-center justify-between py-2 px-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Odalar</span>
        <button
          onClick={onCreateRoom}
          className="text-gray-400 hover:text-white transition-colors"
          title="Yeni oda oluştur"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-0.5">
        {rooms.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            <p>Henüz bir odaya katılmadınız</p>
            <button onClick={onCreateRoom} className="text-blue-400 hover:underline mt-1 text-xs">
              Oda oluştur
            </button>
          </div>
        )}

        {rooms.map((room) => {
          const isActive = activeRoomId === room._id;
          const unread = unreadCounts[room._id] || 0;

          return (
            <button
              key={room._id}
              onClick={() => onRoomClick(room._id)}
              className={`sidebar-item w-full text-left ${isActive ? 'active' : ''}`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center text-sm font-bold text-white">
                {room.type === 'private' ? '🔒' : '#'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{room.name}</p>
                {room.lastMessage && (
                  <p className="text-xs text-gray-500 truncate">
                    {typeof room.lastMessage === 'object' ? room.lastMessage.content : ''}
                  </p>
                )}
              </div>
              {unread > 0 && (
                <span className="flex-shrink-0 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

