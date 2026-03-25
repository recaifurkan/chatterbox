import { useEffect, useRef, useState, useCallback } from 'react';
import MessageItem from './MessageItem';
import { formatMessageDate } from '../../utils/helpers';

const BOTTOM_THRESHOLD = 150;

export default function MessageList({ messages, currentUserId, loading, loadingMore, onLoadMore, hasMore, bottomRef, roomId }) {
  const topRef = useRef(null);
  const containerRef = useRef(null);

  /* ── state & refs ─────────────────────────────────────────────────────── */
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount]   = useState(0);

  const isNearBottomRef    = useRef(true);   // stale-closure koruması
  const isAutoScrollingRef = useRef(false);  // programatik scroll lock
  const prevLastMsgIdRef   = useRef(null);   // append / prepend ayrımı
  const initialDoneRef     = useRef(false);  // ilk yükleme

  /* ── Render sırasında (DOM commit öncesi) scroll pozisyonunu yakala ─── */
  const wasAtBottomRef = useRef(true);
  const prevMsgsRef    = useRef(messages);
  if (messages !== prevMsgsRef.current) {
    const el = containerRef.current;
    if (el) {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasAtBottomRef.current = dist <= BOTTOM_THRESHOLD;
    }
    prevMsgsRef.current = messages;
  }

  /* ── Kullanıcı scroll'u takibi (programatik scroll sırasında yok say) ─ */
  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist <= BOTTOM_THRESHOLD;
    isNearBottomRef.current = atBottom;
    setIsNearBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  /* ── Otomatik scroll helper ───────────────────────────────────────────── */
  const doAutoScroll = useCallback((smooth = true) => {
    isAutoScrollingRef.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView(smooth ? { behavior: 'smooth' } : undefined);
      const delay = smooth ? 400 : 50;
      setTimeout(() => {
        isAutoScrollingRef.current = false;
        isNearBottomRef.current = true;
        setIsNearBottom(true);
      }, delay);
    });
  }, [bottomRef]);

  /* ── Yeni mesaj geldi mi? ─────────────────────────────────────────────── */
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMsg   = messages[messages.length - 1];
    const lastId    = lastMsg?._id;
    const prevId    = prevLastMsgIdRef.current;

    // İlk yükleme — sadece ID kaydet, scroll ayrı handle ediliyor
    if (!prevId) {
      prevLastMsgIdRef.current = lastId;
      return;
    }

    const isAppend = lastId !== prevId;   // son mesaj değiştiyse → sona eklendi
    prevLastMsgIdRef.current = lastId;

    if (!isAppend) return; // prepend veya değişiklik yok

    // Karar: render ÖNCEKİ konum VEYA ref — biri yeterse scroll
    const shouldScroll = wasAtBottomRef.current || isNearBottomRef.current;

    if (shouldScroll) {
      doAutoScroll(true);
    } else {
      setUnreadCount((c) => c + 1);
    }
  }, [messages, doAutoScroll]);

  /* ── Oda değişimi → her şeyi sıfırla ─────────────────────────────────── */
  useEffect(() => {
    initialDoneRef.current     = false;
    prevLastMsgIdRef.current   = null;
    isNearBottomRef.current    = true;
    isAutoScrollingRef.current = false;
    wasAtBottomRef.current     = true;
    setIsNearBottom(true);
    setUnreadCount(0);
  }, [roomId]);

  /* ── İlk yüklemede en alta (animasyonsuz) ─────────────────────────────── */
  useEffect(() => {
    if (messages.length > 0 && !loading && !initialDoneRef.current) {
      initialDoneRef.current = true;
      const t = setTimeout(() => doAutoScroll(false), 50);
      return () => clearTimeout(t);
    }
  }, [messages.length, loading, doAutoScroll]);

  /* ── Butona basınca ───────────────────────────────────────────────────── */
  const scrollToBottom = useCallback(() => {
    doAutoScroll(true);
    setUnreadCount(0);
  }, [doAutoScroll]);

  /* ── Load-more intersection observer ──────────────────────────────────── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore) onLoadMore(); },
      { threshold: 0.1 }
    );
    const el = topRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, onLoadMore]);

  /* ── Loading spinner ──────────────────────────────────────────────────── */
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

  const groupedMessages = groupByDate(messages);

  return (
    <div className="relative flex-1 min-h-0">
      {/* ── Scroll container ──────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain px-4 py-4 space-y-1"
      >
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
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-gray-800 rounded-full border border-gray-700">
                {date}
              </span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

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

      {/* ── Aşağı in butonu ───────────────────────────────────────────────── */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10
                    transition-all duration-300 ease-out
                    ${!isNearBottom
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <button
          onClick={scrollToBottom}
          className="flex items-center gap-2
                     bg-gray-800/90 hover:bg-gray-700 text-white
                     backdrop-blur-sm rounded-full
                     shadow-lg shadow-black/40
                     px-4 py-2 transition-colors duration-200
                     border border-gray-600/60 hover:border-gray-500"
        >
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5
                             bg-blue-500 text-white text-xs font-bold rounded-full
                             animate-bounce-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="text-xs font-medium">
            {unreadCount > 0 ? 'Yeni mesaj' : 'En alta git'}
          </span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
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

