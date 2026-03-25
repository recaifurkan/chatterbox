import { useEffect, useRef } from 'react';
import { useCallStore } from '../../store/callStore';
import CallControls from './CallControls';

/**
 * Tam ekran arama görünümü (LiveKit)
 * callStatus === 'outgoing' || 'connected' olduğunda gösterilir.
 */
export default function CallView() {
  const {
    callStatus,
    callType,
    callDuration,
    callerName,
    localVideoTrack,
    remoteVideoTrack,
    isCameraOff,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Yerel video track'ini bağla (LiveKit track.attach)
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localVideoTrack) {
      localVideoTrack.attach(el);
      // Mobil tarayıcılarda programmatik play gerekebilir
      const tryPlay = () => el.play().catch(() => {});
      tryPlay();
      // Bazı mobil tarayıcılar ilk play'de başarısız olur — kısa gecikmeyle tekrar dene
      const retryTimeout = setTimeout(tryPlay, 300);
      return () => {
        clearTimeout(retryTimeout);
        localVideoTrack.detach(el);
      };
    }
  }, [localVideoTrack]);

  // Uzak video track'ini bağla
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && remoteVideoTrack) {
      remoteVideoTrack.attach(el);
      const tryPlay = () => el.play().catch(() => {});
      tryPlay();
      const retryTimeout = setTimeout(tryPlay, 300);
      return () => {
        clearTimeout(retryTimeout);
        remoteVideoTrack.detach(el);
      };
    }
  }, [remoteVideoTrack]);

  if (callStatus !== 'outgoing' && callStatus !== 'connected') return null;

  // Süre formatla
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isVideoCall = callType === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Üst bilgi çubuğu */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-gray-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${callStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-white font-medium">
            {callerName || 'Arama'}
          </span>
        </div>
        <div className="text-gray-400 text-sm">
          {callStatus === 'outgoing' && 'Aranıyor...'}
          {callStatus === 'connected' && formatDuration(callDuration)}
        </div>
      </div>

      {/* Ana içerik */}
      <div className="flex-1 relative overflow-hidden">
        {isVideoCall ? (
          <>
            {/* Uzak video — tam ekran */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              webkit-playsinline=""
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Uzak video yokken placeholder */}
            {(!remoteVideoTrack || callStatus === 'outgoing') && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto rounded-full bg-gray-700 flex items-center justify-center mb-4">
                    <span className="text-5xl font-bold text-gray-400">
                      {callerName?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  {callStatus === 'outgoing' && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Aranıyor</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Yerel video — küçük PiP */}
            <div className="absolute top-4 right-4 w-36 h-48 md:w-48 md:h-64 rounded-xl overflow-hidden shadow-lg border-2 border-gray-700 bg-gray-800">
              {isCameraOff ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  webkit-playsinline=""
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              )}
            </div>
          </>
        ) : (
          /* Sesli arama — avatar placeholder */
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
            <div className="text-center">
              <div className="relative mx-auto w-40 h-40 mb-6">
                {callStatus === 'connected' && (
                  <div className="absolute inset-0 rounded-full border-4 border-green-500/30 animate-pulse" />
                )}
                <div className="relative w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                  <span className="text-6xl font-bold text-gray-300">
                    {callerName?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{callerName || 'Arama'}</h2>
              <p className="text-gray-400">
                {callStatus === 'outgoing' && (
                  <span className="flex items-center justify-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    Aranıyor
                  </span>
                )}
                {callStatus === 'connected' && (
                  <span className="text-green-400">{formatDuration(callDuration)}</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Kontrol çubuğu */}
      <div className="flex-shrink-0 py-6 px-4 bg-gray-900/90 backdrop-blur-sm">
        <CallControls />
      </div>
    </div>
  );
}
