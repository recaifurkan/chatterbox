import { useState, useEffect } from 'react';
import { searchAPI } from '../../api/message.api';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../UI/Avatar';
import { formatMessageTime, formatMessageDate } from '../../utils/helpers';

export default function SearchPanel({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { activeRoomId, setActiveRoom } = useChatStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) doSearch();
      else setResults([]);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function doSearch() {
    setLoading(true);
    try {
      const { data } = await searchAPI.searchMessages({ q: query, roomId: activeRoomId });
      setResults(data.messages);
    } catch {}
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            placeholder="Mesajlarda ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              <p className="text-sm">"{query}" için sonuç bulunamadı</p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-10 text-gray-500">
              <p className="text-sm">Aramak için en az 2 karakter girin</p>
            </div>
          )}

          {results.map((msg) => (
            <button
              key={msg._id}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-700/50 transition-colors text-left border-b border-gray-700/50 last:border-0"
              onClick={() => {
                setActiveRoom(msg.roomId);
                onClose();
              }}
            >
              <Avatar user={msg.senderId} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">
                    {msg.senderId?.username || 'Kullanıcı'}
                  </span>
                  <span className="text-xs text-gray-500">{formatMessageDate(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-300 line-clamp-2">{msg.content}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

