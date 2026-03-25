/**
 * LiveKit-based WebRTC Manager
 *
 * LiveKit client SDK kullanarak ses/görüntü iletişimini yönetir.
 * Tüm WebRTC karmaşıklığı (SDP, ICE, TURN/STUN) LiveKit tarafından
 * otomatik olarak ele alınır.
 */
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  VideoPresets,
} from 'livekit-client';

class LiveKitManager {
  constructor() {
    /** @type {Room|null} */
    this.room = null;
    /** @type {import('livekit-client').LocalTrack[]} */
    this.localTracks = [];

    // Callbacks
    this.onRemoteTrackSubscribed = null;   // (track, publication, participant) => void
    this.onRemoteTrackUnsubscribed = null; // (track, publication, participant) => void
    this.onParticipantConnected = null;    // (participant) => void
    this.onParticipantDisconnected = null; // (participant) => void
    this.onDisconnected = null;            // () => void
    this.onConnectionStateChange = null;   // (state) => void
  }

  /**
   * Yerel medya track'lerini al (getUserMedia).
   *
   * ⚠️  Bu metot mutlaka kullanıcı etkileşimi (click) bağlamında çağrılmalı.
   *     Tarayıcılar getUserMedia'yı yalnızca user-gesture stack'inde izin verir.
   *     Socket callback veya setTimeout içinden çağrılırsa DOMException atar.
   *
   * @param {'audio'|'video'} callType
   * @returns {Promise<import('livekit-client').LocalTrack[]>}
   */
  async acquireLocalTracks(callType = 'video') {
    // Önceki track'ler varsa durdur
    for (const t of this.localTracks) t.stop();

    // Güvenli bağlam kontrolü — mobil Chrome'da getUserMedia HTTPS gerektirir.
    // Masaüstünde localhost güvenli bağlam sayılır ama mobilde sayılmaz.
    if (!window.isSecureContext) {
      throw new Error(
        'Kamera/mikrofon erişimi yalnızca HTTPS üzerinden çalışır. ' +
        'Lütfen siteye HTTPS ile erişin (ör. ngrok tüneli).'
      );
    }

    // iOS Safari: getUserMedia desteğini kontrol et
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Bu tarayıcı kamera/mikrofon erişimini desteklemiyor');
    }

    // Mobil cihaz tespiti — düşük çözünürlük kullan (performans + uyumluluk)
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    try {
      this.localTracks = await createLocalTracks({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video' ? {
          resolution: isMobile
            ? VideoPresets.h360.resolution   // Mobil: 360p (pil + bant genişliği dostu)
            : VideoPresets.h720.resolution,  // Masaüstü: 720p
          facingMode: 'user',
        } : false,
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Kamera/mikrofon izni reddedildi. Ayarlardan izin verin.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('Kamera veya mikrofon bulunamadı.');
      }
      if (err.name === 'NotReadableError' || err.name === 'AbortError') {
        throw new Error('Kamera/mikrofon başka bir uygulama tarafından kullanılıyor.');
      }
      if (err.name === 'OverconstrainedError') {
        // Kısıtlamalar cihaz tarafından karşılanamıyor — düşük kaliteyle tekrar dene
        this.localTracks = await createLocalTracks({
          audio: true,
          video: callType === 'video' ? { facingMode: 'user' } : false,
        });
        return this.localTracks;
      }
      throw err;
    }

    return this.localTracks;
  }

  /**
   * LiveKit odasına bağlan.
   * acquireLocalTracks() önceden çağrılmış olmalı — track'ler this.localTracks'te.
   *
   * @param {string} url   – LiveKit sunucu WebSocket URL'i
   * @param {string} token – JWT access token (backend tarafından üretilir)
   */
  async connect(url, token) {
    // Önceki bağlantı varsa temizle
    if (this.room) {
      await this.room.disconnect(true);
      this.room = null;
    }

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: isMobile
          ? VideoPresets.h360.resolution
          : VideoPresets.h720.resolution,
      },
      // Mobil ağlar daha stabil olmayabilir — yeniden bağlanma süresini uzat
      reconnectPolicy: {
        maxRetries: isMobile ? 10 : 5,
        initialDelay: 500,
        maxDelay: 10000,
      },
    });

    // Event listener'ları kur
    this._setupRoomEvents();

    // Odaya bağlan
    await this.room.connect(url, token);

    // Önceden alınmış yerel track'leri publish et
    for (const track of this.localTracks) {
      await this.room.localParticipant.publishTrack(track);
    }

    return this.room;
  }

  /**
   * Room event listener'larını kur
   */
  _setupRoomEvents() {
    if (!this.room) return;

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (this.onRemoteTrackSubscribed) {
        this.onRemoteTrackSubscribed(track, publication, participant);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (this.onRemoteTrackUnsubscribed) {
        this.onRemoteTrackUnsubscribed(track, publication, participant);
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (this.onParticipantConnected) {
        this.onParticipantConnected(participant);
      }
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (this.onParticipantDisconnected) {
        this.onParticipantDisconnected(participant);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      if (this.onDisconnected) {
        this.onDisconnected();
      }
    });

    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    });
  }

  /**
   * Yerel ses track'ini al
   * @returns {import('livekit-client').LocalTrack|null}
   */
  getLocalAudioTrack() {
    return this.localTracks.find((t) => t.kind === Track.Kind.Audio) || null;
  }

  /**
   * Yerel video track'ini al
   * @returns {import('livekit-client').LocalTrack|null}
   */
  getLocalVideoTrack() {
    return this.localTracks.find((t) => t.kind === Track.Kind.Video) || null;
  }

  /**
   * Yerel video'yu bir HTML element'e bağla
   * @param {HTMLVideoElement} element
   */
  attachLocalVideo(element) {
    const videoTrack = this.getLocalVideoTrack();
    if (videoTrack && element) {
      videoTrack.attach(element);
    }
  }

  /**
   * Ses aç/kapat
   * @returns {boolean} yeni mute durumu (true = muted)
   */
  toggleAudio() {
    const audioTrack = this.getLocalAudioTrack();
    if (audioTrack) {
      if (audioTrack.isMuted) {
        audioTrack.unmute();
        return false;
      } else {
        audioTrack.mute();
        return true;
      }
    }
    return false;
  }

  /**
   * Kamera aç/kapat
   * @returns {boolean} yeni kamera kapalı durumu (true = off)
   */
  toggleVideo() {
    const videoTrack = this.getLocalVideoTrack();
    if (videoTrack) {
      if (videoTrack.isMuted) {
        videoTrack.unmute();
        return false;
      } else {
        videoTrack.mute();
        return true;
      }
    }
    return true;
  }

  /**
   * Ekran paylaşımı aç/kapat
   * @returns {Promise<boolean>} paylaşım durumu
   */
  async toggleScreenShare() {
    if (!this.room) return false;

    const localParticipant = this.room.localParticipant;
    const isSharing = localParticipant.isScreenShareEnabled;

    if (isSharing) {
      await localParticipant.setScreenShareEnabled(false);
      return false;
    } else {
      await localParticipant.setScreenShareEnabled(true);
      return true;
    }
  }

  /**
   * Tüm bağlantıları kapat ve kaynakları temizle
   */
  async cleanup() {
    // Yerel track'leri durdur
    for (const track of this.localTracks) {
      track.stop();
    }
    this.localTracks = [];

    // Room'u kapat
    if (this.room) {
      await this.room.disconnect(true);
      this.room = null;
    }

    // Callback'leri temizle
    this.onRemoteTrackSubscribed = null;
    this.onRemoteTrackUnsubscribed = null;
    this.onParticipantConnected = null;
    this.onParticipantDisconnected = null;
    this.onDisconnected = null;
    this.onConnectionStateChange = null;
  }
}

// Singleton instance
const livekitManager = new LiveKitManager();
export default livekitManager;
