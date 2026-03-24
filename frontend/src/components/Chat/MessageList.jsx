import { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';
import { formatMessageDate } from '../../utils/helpers';

export default function MessageList({ messages, currentUserId, loading, loadingMore, onLoadMore, hasMore, bottomRef, roomId }) {
  const topRef = useRef(null);
  const containerRef = useRef(null);

  // Intersection observer for "load more" on scroll to top
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore) onLoadMore(); },
      { threshold: 0.1 }
    );
    const el = topRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, onLoadMore]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Mesajlar yükleniyor...</span>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = groupByDate(messages);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {/* Load more trigger */}
      <div ref={topRef} className="h-1" />

      {loadingMore && (
        <div className="flex justify-center py-2">
          <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-500">
          <svg className="w-16 h-16 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Henüz mesaj yok</p>
          <p className="text-xs mt-1">İlk mesajı gönder!</p>
        </div>
      )}

      {groupedMessages.map(({ date, msgs }) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-gray-800 rounded-full border border-gray-700">
              {date}
            </span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Messages in this date group */}
          {msgs.map((message, idx) => {
            const prevMsg = idx > 0 ? msgs[idx - 1] : null;
            const isOwn = (message.senderId?._id || message.senderId) === currentUserId;
            const isContinuation = prevMsg &&
              (prevMsg.senderId?._id || prevMsg.senderId) === (message.senderId?._id || message.senderId) &&
              new Date(message.createdAt) - new Date(prevMsg.createdAt) < 5 * 60 * 1000;

            return (
              <MessageItem
                key={message._id}
                message={message}
                isOwn={isOwn}
                isContinuation={isContinuation}
                roomId={roomId}
              />
            );
          })}
        </div>
      ))}

      <div ref={bottomRef} className="h-1" />
    </div>
  );
}

function groupByDate(messages) {
  const groups = {};
  messages.forEach((msg) => {
    const date = formatMessageDate(msg.createdAt);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
  });
  return Object.entries(groups).map(([date, msgs]) => ({ date, msgs }));
}

