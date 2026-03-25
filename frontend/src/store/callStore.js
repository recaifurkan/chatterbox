import { create } from 'zustand';
import { Track } from 'livekit-client';
import livekitManager from '../utils/livekit';
import { useSocketStore } from './socketStore';
import { SOCKET_EVENTS } from '../utils/constants';
import toast from 'react-hot-toast';

/**
 * Call State Store (LiveKit entegrasyonu)
 *
 * Durumlar: idle → outgoing → connected → idle
 *           idle → incoming → connected → idle
 *
 * Medya iletimi LiveKit SFU üzerinden yapılır.
 * Socket.IO sadece sinyal (arama başlatma/kabul/red/bitirme) taşır.
 */
export const useCallStore = create((set, get) => ({
  // ── State ───────────────────────────────────────────────────────────────
  callStatus: 'idle',       // 'idle' | 'outgoing' | 'incoming' | 'connected'
  callType: 'audio',        // 'audio' | 'video'
  callId: null,
  roomId: null,
  callerId: null,
  callerName: null,
  callerAvatar: null,
  targetUserId: null,
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,
  callDuration: 0,
  connectionState: null,

  // LiveKit specific
  livekitUrl: null,
  livekitToken: null,
  localVideoTrack: null,
  localAudioTrack: null,
  remoteVideoTrack: null,
  remoteAudioTrack: null,
  remoteParticipantName: null,

  // ── Timer ───────────────────────────────────────────────────────────────
  _durationInterval: null,

  // ── Arama başlat (arayan taraf) ─────────────────────────────────────────
  // ⚠️ Bu fonksiyon doğrudan onClick handler'dan çağrılmalı.
  //    getUserMedia izni ancak user-gesture stack'inde alınabilir.
  initiateCall: async ({ roomId, targetUserId, targetUserName, callType = 'audio' }) => {
    const { callStatus } = get();
    if (callStatus !== 'idle') return;

    try {
      // 1) Medya izinlerini HEMEN al (click bağlamında)
      await livekitManager.acquireLocalTracks(callType);

      set({
        callStatus: 'outgoing',
        callType,
        roomId,
        targetUserId,
        callerName: targetUserName || null,
        localVideoTrack: livekitManager.getLocalVideoTrack(),
        localAudioTrack: livekitManager.getLocalAudioTrack(),
        isMuted: false,
        isCameraOff: false,
        callDuration: 0,
      });

      // 2) Sinyal gönder
      const { emit } = useSocketStore.getState();
      emit(SOCKET_EVENTS.CALL_INITIATE, { roomId, targetUserId, callType });
    } catch (err) {
      console.error('[CallStore] initiateCall — media access denied:', err);
      toast.error(`Mikrofon/kamera izni alınamadı: ${err.name || err.message}`);
      await livekitManager.cleanup();
      get()._resetState();
    }
  },

  // ── Gelen aramayı kabul et (aranan taraf) ───────────────────────────────
  // ⚠️ Bu fonksiyon doğrudan onClick handler'dan çağrılmalı.
  //    getUserMedia izni ancak user-gesture stack'inde alınabilir.
  acceptCall: async () => {
    const { callId, callType } = get();
    if (!callId) return;

    try {
      // 1) Medya izinlerini HEMEN al (click bağlamında)
      await livekitManager.acquireLocalTracks(callType);

      set({
        callStatus: 'connected',
        localVideoTrack: livekitManager.getLocalVideoTrack(),
        localAudioTrack: livekitManager.getLocalAudioTrack(),
        isMuted: false,
        isCameraOff: false,
      });

      // 2) Sinyal gönder — backend LiveKit tokenleri üretip geri gönderecek
      const { emit } = useSocketStore.getState();
      emit(SOCKET_EVENTS.CALL_ACCEPT, { callId });
    } catch (err) {
      console.error('[CallStore] acceptCall — media access denied:', err);
      toast.error(`Mikrofon/kamera izni alınamadı: ${err.name || err.message}`);
      await livekitManager.cleanup();
      get()._resetState();
    }
  },

  // ── Aramayı reddet (aranan taraf) ───────────────────────────────────────
  rejectCall: () => {
    const { callId } = get();
    if (callId) {
      const { emit } = useSocketStore.getState();
      emit(SOCKET_EVENTS.CALL_REJECT, { callId });
    }
    get()._resetState();
  },

  // ── Aramayı sonlandır ───────────────────────────────────────────────────
  endCall: async () => {
    const { callId } = get();
    if (callId) {
      const { emit } = useSocketStore.getState();
      emit(SOCKET_EVENTS.CALL_END, { callId });
    }
    await livekitManager.cleanup();
    get()._resetState();
  },

  // ── CALL_ACCEPT geldi — LiveKit'e bağlan (her iki taraf için) ───────────
  // Track'ler initiateCall/acceptCall'da önceden alındı (user-gesture bağlamında).
  // Bu metot yalnızca LiveKit sunucusuna bağlanıp track'leri publish eder.
  handleCallAccepted: async ({ callId, userId, livekitServerId, livekitToken }) => {
    // Server sadece serverId gönderir — URL'i tarayıcının mevcut host'undan oluştur.
    // Nginx /livekit/<serverId> path'ini doğru LiveKit container'a yönlendirir.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const livekitUrl = `${protocol}//${window.location.host}/livekit/${livekitServerId}`;

    set({
      callStatus: 'connected',
      livekitUrl,
      livekitToken,
    });

    // LiveKit event callback'lerini kur
    livekitManager.onRemoteTrackSubscribed = (track, publication, participant) => {
      if (track.kind === Track.Kind.Video) {
        set({ remoteVideoTrack: track, remoteParticipantName: participant.name || participant.identity });
      } else if (track.kind === Track.Kind.Audio) {
        set({ remoteAudioTrack: track });
        // Ses track'ini çal — iOS Safari için özel işlem
        const audioEl = track.attach();
        audioEl.setAttribute('data-livekit-audio', 'remote');
        audioEl.setAttribute('playsinline', '');
        audioEl.setAttribute('autoplay', '');
        // iOS Safari bazen autoplay'i engeller; açıkça .play() çağır
        document.body.appendChild(audioEl);
        const playPromise = audioEl.play();
        if (playPromise) {
          playPromise.catch((e) => {
            console.warn('[CallStore] iOS audio play failed, retrying on next tick:', e);
            // iOS'ta küçük bir gecikme ile tekrar dene
            setTimeout(() => audioEl.play().catch(() => {}), 100);
          });
        }
      }
    };

    livekitManager.onRemoteTrackUnsubscribed = (track) => {
      if (track.kind === Track.Kind.Video) {
        set({ remoteVideoTrack: null });
      } else if (track.kind === Track.Kind.Audio) {
        set({ remoteAudioTrack: null });
        const audioEls = document.querySelectorAll('[data-livekit-audio="remote"]');
        audioEls.forEach((el) => el.remove());
      }
      track.detach();
    };

    livekitManager.onParticipantDisconnected = () => {
      get().endCall();
    };

    livekitManager.onDisconnected = () => {
      get()._resetState();
    };

    try {
      // Track'ler zaten acquireLocalTracks ile alınmıştı —
      // Burada sadece odaya bağlan ve publish et
      await livekitManager.connect(livekitUrl, livekitToken);

      // Yerel track'leri store'a kaydet (zaten set edilmiş olabilir ama
      // connect sonrası güncel referansları tekrar al)
      set({
        localVideoTrack: livekitManager.getLocalVideoTrack(),
        localAudioTrack: livekitManager.getLocalAudioTrack(),
      });

      // Süre sayacını başlat
      get()._startDurationTimer();
    } catch (err) {
      console.error('[CallStore] LiveKit connect error:', err);
      toast.error(`LiveKit bağlantı hatası: ${err.name || err.message}`);
      get().endCall();
    }
  },

  // ── Ses aç/kapat ───────────────────────────────────────────────────────
  toggleMute: () => {
    const isMuted = livekitManager.toggleAudio();
    set({ isMuted });
  },

  // ── Kamera aç/kapat ───────────────────────────────────────────────────
  toggleCamera: () => {
    const isCameraOff = livekitManager.toggleVideo();
    set({ isCameraOff });
  },

  // ── Ekran paylaşımı ───────────────────────────────────────────────────
  toggleScreenShare: async () => {
    try {
      const isSharing = await livekitManager.toggleScreenShare();
      set({ isScreenSharing: isSharing });
    } catch (err) {
      console.warn('[CallStore] Screen share error:', err);
    }
  },

  // ── Gelen arama (sinyal sunucusundan) ──────────────────────────────────
  handleIncomingCall: ({ callId, roomId, callType, callerId, callerName, callerAvatar }) => {
    const { callStatus } = get();
    if (callStatus !== 'idle') return;

    set({
      callStatus: 'incoming',
      callId,
      roomId,
      callType,
      callerId,
      callerName,
      callerAvatar,
      callDuration: 0,
    });
  },

  // ── Karşı taraf reddetti ───────────────────────────────────────────────
  handleCallRejected: async () => {
    await livekitManager.cleanup();
    get()._resetState();
  },

  // ── Karşı taraf sonlandırdı ────────────────────────────────────────────
  handleCallEnded: async () => {
    await livekitManager.cleanup();
    // Ses element'lerini temizle
    const audioEls = document.querySelectorAll('[data-livekit-audio="remote"]');
    audioEls.forEach((el) => el.remove());
    get()._resetState();
  },

  // ── Karşı taraf meşgul ────────────────────────────────────────────────
  handleCallBusy: async () => {
    await livekitManager.cleanup();
    get()._resetState();
  },

  // ── Internal: süre sayacı ──────────────────────────────────────────────
  _startDurationTimer: () => {
    const { _durationInterval } = get();
    if (_durationInterval) clearInterval(_durationInterval);

    const interval = setInterval(() => {
      set((s) => ({ callDuration: s.callDuration + 1 }));
    }, 1000);
    set({ _durationInterval: interval });
  },

  // ── Internal: state sıfırla ────────────────────────────────────────────
  _resetState: () => {
    const { _durationInterval } = get();
    if (_durationInterval) clearInterval(_durationInterval);

    set({
      callStatus: 'idle',
      callType: 'audio',
      callId: null,
      roomId: null,
      callerId: null,
      callerName: null,
      callerAvatar: null,
      targetUserId: null,
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      callDuration: 0,
      connectionState: null,
      livekitUrl: null,
      livekitToken: null,
      localVideoTrack: null,
      localAudioTrack: null,
      remoteVideoTrack: null,
      remoteAudioTrack: null,
      remoteParticipantName: null,
      _durationInterval: null,
    });
  },
}));

