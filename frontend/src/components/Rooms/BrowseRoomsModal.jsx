import { useState, useEffect } from 'react';
import { roomAPI } from '../../api/room.api';
import { useChatStore } from '../../store/chatStore';
import { useSocketStore } from '../../store/socketStore';
import Avatar from '../UI/Avatar';
import toast from 'react-hot-toast';

export default function BrowseRoomsModal({ onClose }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);
  const [search, setSearch] = useState('');
  const { rooms: myRooms, addOrUpdateRoom, setActiveRoom } = useChatStore();
  const { emit } = useSocketStore();

  const myRoomIds = new Set(myRooms.map((r) => r._id));

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    setLoading(true);
    try {
      const { data } = await roomAPI.getPublicRooms(1, 100);
      setRooms(data.rooms);
    } catch { toast.error('Odalar yüklenemedi'); }
    setLoading(false);
  }

  async function handleJoin(room) {
    setJoining(room._id);
    try {
      const joined = await roomAPI.joinRoom(room._id);
      addOrUpdateRoom(joined);
      setActiveRoom(joined._id);
      emit('join_room', { roomId: joined._id });
      toast.success(`#${joined.name} odasına katıldınız`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Katılınamadı');
    }
    setJoining(null);
  }

  function handleEnter(room) {
    setActiveRoom(room._id);
    emit('join_room', { roomId: room._id });
    onClose();
  }

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Odaları Keşfet</h2>
            <p className="text-xs text-gray-400 mt-0.5">Herkese açık odalara katıl</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Oda ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm"
            />
          </div>
        </div>

        {/* Room list */}
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex justify-center py-10">
              <svg className="animate-spin w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              {search ? `"${search}" için oda bulunamadı` : 'Henüz genel oda yok'}
            </div>
          ) : (
            filtered.map((room) => {
              const isMember = myRoomIds.has(room._id);
              return (
                <div key={room._id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-700/50 border-b border-gray-700/50 last:border-0 transition-colors">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {room.name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm truncate"># {room.name}</p>
                      {isMember && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full font-medium">
                          Üyesin
                        </span>
                      )}
                    </div>
                    {room.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{room.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{room.members?.length || 0} üye</p>
                  </div>

                  {/* Action */}
                  {isMember ? (
                    <button onClick={() => handleEnter(room)}
                      className="flex-shrink-0 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded-lg transition-colors font-medium">
                      Gir
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoin(room)}
                      disabled={joining === room._id}
                      className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors font-medium">
                      {joining === room._id ? '...' : 'Katıl'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

