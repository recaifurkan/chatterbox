import { useState } from 'react';
import { useSocketStore } from '../../store/socketStore';
import { messageAPI } from '../../api/message.api';
import { useUIStore } from '../../store/uiStore';
import Avatar from '../UI/Avatar';
import { formatMessageTime, formatFileSize } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function MessageItem({ message, isOwn, isContinuation, roomId }) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const { emit } = useSocketStore();
  const { openModal } = useUIStore();

  const sender = message.senderId;
  const isDeleted = message.isDeleted;

  async function handleEdit() {
    if (!editText.trim()) return;
    try {
      emit('edit_message', { messageId: message._id, content: editText.trim() });
      setEditing(false);
    } catch {
      toast.error('Düzenlenemedi');
    }
  }

  function handleDelete() {
    if (confirm('Bu mesajı silmek istiyor musunuz?')) {
      emit('delete_message', { messageId: message._id });
    }
  }

  function handleReact(emoji) {
    emit('add_reaction', { messageId: message._id, emoji });
  }

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  return (
    <div
      className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isContinuation ? 'mt-0.5' : 'mt-3'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8">
        {!isContinuation && !isOwn && (
          <button onClick={() => openModal('userProfile', { userId: sender?._id })}>
            <Avatar user={sender} size="sm" />
          </button>
        )}
      </div>

      {/* Bubble + meta */}
      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name + time */}
        {!isContinuation && (
          <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
            {!isOwn && (
              <button
                onClick={() => openModal('userProfile', { userId: sender?._id })}
                className="text-xs font-semibold text-blue-400 hover:underline"
              >
                {typeof sender === 'object' ? sender?.username : 'User'}
              </button>
            )}
            <span className="text-[10px] text-gray-500">{formatMessageTime(message.createdAt)}</span>
            {message.isEdited && <span className="text-[10px] text-gray-500 italic">(düzenlendi)</span>}
          </div>
        )}

        {/* Message bubble */}
        {editing ? (
          <div className="flex flex-col gap-1 w-full">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="input-field text-sm resize-none"
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="flex gap-1">
              <button onClick={handleEdit} className="btn-primary px-3 py-1 text-xs">Kaydet</button>
              <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-1 text-xs">İptal</button>
            </div>
          </div>
        ) : (
          <div className={`relative message-bubble ${isOwn ? 'own' : 'other'} ${isDeleted ? 'opacity-50 italic' : ''}`}>
            {/* Reply quote */}
            {message.replyTo && (
              <div className="border-l-2 border-blue-400 pl-2 mb-1 text-xs text-gray-300 opacity-70 truncate">
                {message.replyTo.content || 'Mesaj'}
              </div>
            )}

            {/* Attachments */}
            {message.attachments?.length > 0 && (
              <div className="mb-1 flex flex-col gap-1">
                {message.attachments.map((att, i) => (
                  <AttachmentPreview key={i} attachment={att} />
                ))}
              </div>
            )}

            {/* Text content */}
            {message.content && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderContent(message.content)}</p>
            )}

            {/* Read receipts */}
            {isOwn && message.readBy?.length > 0 && (
              <div className={`flex justify-end mt-0.5`}>
                <svg className="w-3 h-3 text-blue-300" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.897.896 5.896-5.896.707.707-6.311 6.297z" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {message.reactions.filter((r) => r.count > 0).map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReact(reaction.emoji)}
                className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 rounded-full px-2 py-0.5 text-xs transition-colors"
              >
                <span>{reaction.emoji}</span>
                <span className="text-gray-300">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating action buttons */}
      {showActions && !isDeleted && !editing && (
        <div className={`flex-shrink-0 flex items-start gap-0.5 ${isOwn ? 'flex-row-reverse order-first' : ''} opacity-0 group-hover:opacity-100 transition-opacity pt-1`}>
          {/* Quick reactions */}
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => handleReact(e)}
              className="w-7 h-7 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors"
            >
              {e}
            </button>
          ))}

          {isOwn && (
            <>
              <button
                onClick={() => { setEditing(true); setEditText(message.content); }}
                className="w-7 h-7 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors"
                title="Düzenle"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                className="w-7 h-7 text-gray-400 hover:text-red-400 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors"
                title="Sil"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tüm URL formatlarını /api/v1/files/<objectName> formatına dönüştürür.
 * Desteklenen eski formatlar:
 *   http://localhost/storage/chat-uploads/images/x.jpg
 *   /storage/chat-uploads/images/x.jpg
 *   /api/v1/files/images/x.jpg  (yeni format — dokunma)
 */
function resolveUrl(url) {
  if (!url) return url;
  if (url.startsWith('/api/v1/files/')) return url;

  // Bucket adını URL içinde bul, sonrasını objectName olarak al
  const BUCKET = 'chat-uploads';
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return `/api/v1/files/${url.substring(idx + marker.length)}`;
  }

  return url;
}

function AttachmentPreview({ attachment }) {
  const url = resolveUrl(attachment.url);

  if (attachment.mimeType?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={attachment.originalName}
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          style={{ maxHeight: 300 }}
        />
      </a>
    );
  }
  if (attachment.mimeType?.startsWith('video/')) {
    return (
      <video src={url} controls className="max-w-xs rounded-lg" style={{ maxHeight: 250 }} />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-gray-600/50 rounded-lg p-2 hover:bg-gray-600 transition-colors"
    >
      <span className="text-2xl">{attachment.mimeType?.includes('pdf') ? '📄' : '📎'}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-white truncate">{attachment.originalName}</p>
        <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
      </div>
    </a>
  );
}

function renderContent(content) {
  // Highlight @mentions
  return content.split(/(@\w+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-blue-300 font-medium">{part}</span>
    ) : part
  );
}

