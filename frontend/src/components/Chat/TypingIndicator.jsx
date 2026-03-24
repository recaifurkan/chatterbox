import { useChatStore } from '../../store/chatStore';

export default function TypingIndicator({ roomId }) {
  const { typingUsers } = useChatStore();
  const users = Object.values(typingUsers[roomId] || {});

  if (!users.length) return null;

  const text = users.length === 1
    ? `${users[0]} yazıyor`
    : users.length === 2
    ? `${users[0]} ve ${users[1]} yazıyor`
    : `${users.length} kişi yazıyor`;

  return (
    <div className="px-4 py-1 flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full inline-block" />
        <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full inline-block" />
        <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full inline-block" />
      </div>
      <span className="text-xs text-gray-400 italic">{text}...</span>
    </div>
  );
}

