import { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

export default function EmojiPickerButton({ onEmojiSelect }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-shrink-0 self-end mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
        title="Emoji ekle"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1 z-50">
          <Picker
            data={data}
            onEmojiSelect={(emoji) => {
              onEmojiSelect(emoji);
              setOpen(false);
            }}
            theme="dark"
            locale="tr"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}
    </div>
  );
}

