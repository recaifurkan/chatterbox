import { useEffect, useRef } from 'react';
import { useCallStore } from '../../store/callStore';

/**
 * Gelen arama modalı — tam ekran overlay
 * callStatus === 'incoming' olduğunda gösterilir.
 */
export default function IncomingCallModal() {
  const {
    callStatus,
    callType,
    callerName,
    callerAvatar,
    acceptCall,
    rejectCall,
  } = useCallStore();

  const ringtoneRef = useRef(null);

  // Basit zil sesi (Web Audio API)
  useEffect(() => {
    if (callStatus !== 'incoming') return;

    let ctx;
    let intervalId;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS Safari: AudioContext "suspended" başlar, resume() gerekli
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const playBeep = () => {
        if (ctx.state === 'suspended') return; // iOS'ta hâlâ suspend ise atla
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      };
      playBeep();
      intervalId = setInterval(playBeep, 2000);
    } catch (_) {
      // Audio API desteklenmiyor — sessizce devam et
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (ctx) ctx.close().catch(() => {});
    };
  }, [callStatus]);

  if (callStatus !== 'incoming') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl animate-fade-in">
        {/* Pulse animasyonu */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
            {callerAvatar ? (
              <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">
                {callerName?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
        </div>

        {/* Bilgi */}
        <h2 className="text-xl font-bold text-white mb-1">{callerName || 'Bilinmeyen'}</h2>
        <p className="text-gray-400 mb-8">
          {callType === 'video' ? '📹 Görüntülü arama' : '📞 Sesli arama'}
        </p>

        {/* Butonlar */}
        <div className="flex items-center justify-center gap-8">
          {/* Reddet */}
          <button
            onClick={rejectCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center
                          hover:bg-red-700 transition-colors group-hover:scale-110 transform duration-200">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Reddet</span>
          </button>

          {/* Kabul et */}
          <button
            onClick={acceptCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center
                          hover:bg-green-700 transition-colors group-hover:scale-110 transform duration-200">
              {callType === 'video' ? (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-400">Kabul et</span>
          </button>
        </div>
      </div>
    </div>
  );
}

