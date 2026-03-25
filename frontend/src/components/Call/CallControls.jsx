import { useCallStore } from '../../store/callStore';

/**
 * Arama kontrol butonları: Mute, Kamera, Ekran paylaşımı, Kapat
 */
export default function CallControls() {
  const {
    isMuted,
    isCameraOff,
    isScreenSharing,
    callType,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    endCall,
  } = useCallStore();

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute / Unmute */}
      <button
        onClick={toggleMute}
        className={`p-4 rounded-full transition-all ${
          isMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        title={isMuted ? 'Sesi aç' : 'Sesi kapat'}
      >
        {isMuted ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Camera toggle — sadece video aramada */}
      {callType === 'video' && (
        <button
          onClick={toggleCamera}
          className={`p-4 rounded-full transition-all ${
            isCameraOff
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isCameraOff ? 'Kamerayı aç' : 'Kamerayı kapat'}
        >
          {isCameraOff ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}

      {/* Ekran paylaşımı — sadece video aramada */}
      {callType === 'video' && (
        <button
          onClick={toggleScreenShare}
          className={`p-4 rounded-full transition-all ${
            isScreenSharing
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isScreenSharing ? 'Ekran paylaşımını durdur' : 'Ekran paylaş'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      )}

      {/* Aramayı sonlandır */}
      <button
        onClick={endCall}
        className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all"
        title="Aramayı sonlandır"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      </button>
    </div>
  );
}

