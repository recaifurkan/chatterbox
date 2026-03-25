import { useState, useRef } from 'react';
import { useSocketStore } from '../../store/socketStore';
import { uploadAPI } from '../../api/index.js';
import { formatFileSize } from '../../utils/helpers';
import EmojiPickerButton from '../UI/EmojiPickerButton';
import toast from 'react-hot-toast';

export default function MessageInput({ roomId }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { emit, socket } = useSocketStore();
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  function handleTyping() {
    emit('typing_start', { roomId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emit('typing_stop', { roomId }), 3000);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadAPI.uploadFiles(files, setUploadProgress);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      toast.error('Dosya yüklenemedi');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function sendMessage() {
    if (!text.trim() && !attachments.length) return;
    clearTimeout(typingTimeoutRef.current);
    emit('typing_stop', { roomId });
    emit('send_message', {
      roomId,
      content: text.trim(),
      attachments,
    });
    setText('');
    setAttachments([]);
    textareaRef.current?.focus();
  }

  function onEmojiSelect(emoji) {
    setText((prev) => prev + emoji.native);
    textareaRef.current?.focus();
  }

  return (
    <div className="px-4 pb-4 safe-bottom">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((file, idx) => (
            <div key={idx} className="relative group bg-gray-700 rounded-lg p-2 flex items-center gap-2 text-sm">
              {file.mimeType?.startsWith('image/') ? (
                <img src={file.url} className="w-12 h-12 rounded object-cover" alt="" />
              ) : (
                <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center text-lg">
                  {file.mimeType?.includes('pdf') ? '📄' : file.mimeType?.startsWith('video/') ? '🎥' : '📎'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-white truncate max-w-24">{file.originalName}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => removeAttachment(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mb-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 bg-gray-700 rounded-xl px-3 py-2 border border-gray-600 focus-within:border-blue-500 transition-colors">
        {/* File attach */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50 self-end mb-0.5"
          title="Dosya ekle"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.zip,.txt" className="hidden" onChange={handleFileChange} />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Mesaj yaz..."
          className="flex-1 bg-transparent text-white placeholder-gray-400 resize-none outline-none text-sm min-h-[24px] max-h-32 py-1"
          rows={1}
          style={{ height: 'auto' }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
          }}
        />

        {/* Emoji picker */}
        <EmojiPickerButton onEmojiSelect={onEmojiSelect} />

        {/* Send button */}
        <button
          onClick={sendMessage}
          disabled={!text.trim() && !attachments.length}
          className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors self-end"
          title="Gönder"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

