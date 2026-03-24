import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import { useUIStore } from '../../store/uiStore';
import { messageAPI } from '../../api/message.api';
import { roomAPI } from '../../api/room.api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import TypingIndicator from './TypingIndicator';
import toast from 'react-hot-toast';

export default function ChatWindow() {
  const { activeRoomId, rooms, messages, setMessages, prependMessages, setMessagePagination, messagePagination } = useChatStore();
  const { user } = useAuthStore();
  const { emit } = useSocketStore();
  const { openModal } = useUIStore();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef(null);
  const currentMessages = messages[activeRoomId] || [];
  const pagination = messagePagination[activeRoomId] || {};

  useEffect(() => {
    if (!activeRoomId) return;
    loadRoom();
    loadMessages();
  }, [activeRoomId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (currentMessages.length > 0) {
      const last = currentMessages[currentMessages.length - 1];
      if (last?.senderId?._id === user?._id || !pagination.hasLoaded) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [currentMessages.length]);

  async function loadRoom() {
    try {
      const r = await roomAPI.getRoom(activeRoomId);
      setRoom(r);
    } catch {}
  }

  async function loadMessages(before = null) {
    if (loading) return;
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (before) params.before = before;
      const { data, meta } = await messageAPI.getMessages(activeRoomId, params);
      const msgs = data.messages;

      if (before) {
        prependMessages(activeRoomId, msgs);
      } else {
        setMessages(activeRoomId, msgs);
        setMessagePagination(activeRoomId, { hasLoaded: true });
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }

      setMessagePagination(activeRoomId, {
        hasMore: meta?.hasNextPage ?? false,
        oldest: msgs[0]?.createdAt,
        hasLoaded: true,
      });

      // Mark all visible messages as read
      const unreadIds = msgs.filter((m) => !m.readBy?.some((r) => r.user === user?._id)).map((m) => m._id);
      if (unreadIds.length) emit('mark_read', { roomId: activeRoomId, messageIds: unreadIds });
    } catch {
      toast.error('Mesajlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !pagination.hasMore || !pagination.oldest) return;
    setLoadingMore(true);
    await loadMessages(pagination.oldest);
    setLoadingMore(false);
  }, [loadingMore, pagination]);

  if (!activeRoomId) return null;

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        room={room}
        onMembersClick={() => openModal('invite', { roomId: activeRoomId })}
        onSearchClick={() => openModal('search')}
      />
      <MessageList
        messages={currentMessages}
        currentUserId={user?._id}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMoreMessages}
        hasMore={pagination.hasMore}
        bottomRef={bottomRef}
        roomId={activeRoomId}
      />
      <div className="flex-shrink-0">
        <TypingIndicator roomId={activeRoomId} />
        <MessageInput roomId={activeRoomId} />
      </div>
    </div>
  );
}

