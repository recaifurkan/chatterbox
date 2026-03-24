import { useState, useEffect } from 'react';
import { roomAPI } from '../../api/room.api';
import { userAPI } from '../../api/index.js';
import Avatar from '../UI/Avatar';
import StatusBadge from '../User/StatusBadge';
import { useChatStore } from '../../store/chatStore';
import toast from 'react-hot-toast';

export default function InviteModal({ room, onClose }) {
  const [tab, setTab] = useState(room?.type === 'private' ? 'invite' : 'members');
  const [members, setMembers] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [copied, setCopied] = useState(false);
  const { userPresence } = useChatStore();

  useEffect(() => { loadMembers(); }, []);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(doSearch, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function loadMembers() {
    try {
      const m = await roomAPI.getMembers(room._id);
      setMembers(m);
    } catch {}
  }

  async function doSearch() {
    setSearching(true);
    try {
      const users = await userAPI.searchUsers(searchQ);
      const memberIds = new Set(members.map((m) => m.user?._id || m.user));
      setSearchResults(users.filter((u) => !memberIds.has(u._id)));
    } catch {}
    setSearching(false);
  }

  async function handleAdd(user) {
    setAdding(user._id);
    try {
      const updated = await roomAPI.addMember(room._id, user._id);
      setMembers(updated);
      setSearchResults((prev) => prev.filter((u) => u._id !== user._id));
      toast.success(`${user.username} odaya eklendi`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Eklenemedi');
    }
    setAdding(null);
  }

  function copyInviteCode() {
    if (!room.inviteCode) return;
    navigator.clipboard.writeText(room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/join/${room.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const getPresence = (userId) => {
    const id = userId?._id || userId;
    return userPresence[id]?.status || (userId?.isOnline ? 'online' : 'offline');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      onClick={onClose}>
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            # {room?.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button onClick={() => setTab('members')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'members' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
            Üyeler ({members.length})
          </button>
          <button onClick={() => setTab('invite')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'invite' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
            Davet Et
          </button>
          {room?.type === 'private' && room?.inviteCode && (
            <button onClick={() => setTab('code')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'code' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}>
              Davet Kodu
            </button>
          )}
        </div>

        {/* Tab: Members */}
        {tab === 'members' && (
          <div className="max-h-80 overflow-y-auto">
            {members.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">Üye yok</p>
            ) : (
              members.map((m) => {
                const user = m.user;
                const userId = user?._id || user;
                const status = getPresence(user);
                return (
                  <div key={userId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-700/30 transition-colors">
                    <div className="relative flex-shrink-0">
                      <Avatar user={user} size="sm" />
                      <StatusBadge status={status} className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {typeof user === 'object' ? user?.username : 'Kullanıcı'}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{status}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === 'owner'     ? 'bg-yellow-500/20 text-yellow-400' :
                      m.role === 'admin'     ? 'bg-blue-500/20 text-blue-400' :
                      m.role === 'moderator' ? 'bg-purple-500/20 text-purple-400' :
                      'text-gray-500'
                    }`}>
                      {m.role === 'owner' ? 'Kurucu' : m.role === 'admin' ? 'Admin' : m.role === 'moderator' ? 'Mod' : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Invite (search + add) */}
        {tab === 'invite' && (
          <div className="p-4">
            <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2 mb-3">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Kullanıcı adı veya e-posta ara..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm"
              />
              {searching && (
                <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1">
              {searchQ.length < 2 && (
                <p className="text-center text-gray-500 text-xs py-4">Aramak için en az 2 karakter girin</p>
              )}
              {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-center text-gray-500 text-xs py-4">Kullanıcı bulunamadı</p>
              )}
              {searchResults.map((user) => (
                <div key={user._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50 transition-colors">
                  <Avatar user={user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.username}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(user)}
                    disabled={adding === user._id}
                    className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors font-medium">
                    {adding === user._id ? '...' : 'Ekle'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Invite Code */}
        {tab === 'code' && room?.inviteCode && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Davet Kodu</p>
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-3">
                <code className="flex-1 text-blue-300 font-mono text-sm tracking-wider select-all">
                  {room.inviteCode}
                </code>
                <button onClick={copyInviteCode}
                  className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                  {copied ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Davet Linki</p>
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-3">
                <p className="flex-1 text-gray-300 text-xs truncate">
                  {window.location.origin}/join/{room.inviteCode}
                </p>
                <button onClick={copyInviteLink}
                  className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Bu kodu alan kullanıcılar odaya katılabilir. Kodu paylaşırken dikkatli olun.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

