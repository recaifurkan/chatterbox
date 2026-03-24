import { useState, useEffect } from 'react';
import { userAPI } from '../../api/index.js';
import { roomAPI } from '../../api/room.api';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../UI/Avatar';
import StatusBadge from './StatusBadge';
import { formatRelativeTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Çevrimiçi', color: 'text-green-400' },
  { value: 'busy', label: 'Meşgul', color: 'text-yellow-400' },
  { value: 'idle', label: 'Boşta', color: 'text-yellow-300' },
  { value: 'offline', label: 'Görünmez', color: 'text-gray-400' },
];

export default function UserProfileModal({ onClose }) {
  const { modalData } = useUIStore();
  const propUserId = modalData?.userId;
  const propIsSelf = modalData?.isSelf;
  return <UserProfileModalInner onClose={onClose} userId={propUserId} isSelf={propIsSelf} />;
}

export function UserProfileModalInner({ onClose, userId: propUserId, isSelf: propIsSelf }) {
  const { user: currentUser, updateUser } = useAuthStore();
  const { emit } = useSocketStore();
  const { setSidebarTab } = useUIStore();
  const { addOrUpdateRoom, setActiveRoom, activeRoomId } = useChatStore();

  // Use prop values or defaults
  const userId = propUserId || currentUser?._id;
  const isSelf = propIsSelf !== undefined ? propIsSelf : userId === currentUser?._id;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  async function loadProfile() {
    try {
      const p = await userAPI.getProfile(userId);
      setProfile(p);
      setEditForm({ username: p.username, bio: p.bio || '', statusMessage: p.statusMessage || '' });
    } catch { toast.error('Profil yüklenemedi'); }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let avatarUrl = profile.avatarUrl;
      if (avatarFile) {
        avatarUrl = await userAPI.uploadAvatar(avatarFile);
      }
      const updated = await userAPI.updateProfile({ ...editForm });
      updateUser({ ...updated, avatarUrl });
      setProfile((p) => ({ ...p, ...updated, avatarUrl }));
      setEditing(false);
      setAvatarFile(null);
      toast.success('Profil güncellendi');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Güncelleme başarısız');
    }
    setSaving(false);
  }

  async function handleStatusChange(status) {
    try {
      await userAPI.setStatus(status);
      updateUser({ status });
      setProfile((p) => ({ ...p, status }));
      emit('set_status', { status });
    } catch {}
  }

  async function handleStartDM() {
    try {
      const room = await roomAPI.openDM(userId);
      addOrUpdateRoom(room);
      if (activeRoomId) emit('leave_room', { roomId: activeRoomId });
      setActiveRoom(room._id);
      emit('join_room', { roomId: room._id });
      setSidebarTab('dms');
      onClose();
    } catch {
      toast.error('Mesaj açılamadı');
    }
  }

  async function handleBlock() {
    try {
      await userAPI.blockUser(userId);
      toast.success('Kullanıcı engellendi');
      onClose();
    } catch { toast.error('İşlem başarısız'); }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Tarayıcıda HEIC önizleme olmayabilir ama backend JPEG'e çevirir
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Resim 10 MB\'dan büyük olamaz');
      return;
    }
    setAvatarFile(file);
    // HEIC için URL.createObjectURL çalışmayabilir; fallback: dosya adını göster
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
      setAvatarPreview(null); // preview yok, dosya adını göster
      toast('HEIC dosyası seçildi — sunucu JPEG\'e dönüştürecek', { icon: 'ℹ️' });
    } else {
      setAvatarPreview(URL.createObjectURL(file));
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-800 rounded-2xl p-8 animate-pulse">
          <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4" />
          <div className="w-32 h-4 bg-gray-700 rounded mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-blue-600 to-purple-600" />

        {/* Avatar + close */}
        <div className="px-5 -mt-10 flex items-end justify-between">
          <div className="relative">
            {editing ? (
              <label className="cursor-pointer group">
                <div className="w-20 h-20 rounded-full border-4 border-gray-800 overflow-hidden bg-gray-700">
                  {avatarPreview || profile?.avatarUrl ? (
                    <img src={avatarPreview || profile?.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Avatar user={profile} size="xl" />
                  )}
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </label>
            ) : (
              <div className="w-20 h-20 rounded-full border-4 border-gray-800 overflow-hidden">
                <Avatar user={profile} size="xl" />
              </div>
            )}
            {!editing && (
              <StatusBadge status={profile?.status || 'offline'} className="absolute bottom-1 right-1 !w-4 !h-4 border-[3px]" />
            )}
          </div>
          <button onClick={onClose} className="mb-2 text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="px-5 py-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Kullanıcı Adı</label>
                <input className="input-field text-sm" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Bio</label>
                <textarea className="input-field text-sm resize-none" rows={2} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} maxLength={200} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Durum Mesajı</label>
                <input className="input-field text-sm" value={editForm.statusMessage} onChange={(e) => setEditForm({ ...editForm, statusMessage: e.target.value })} maxLength={100} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2 text-sm">
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost flex-1 py-2 text-sm">İptal</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{profile?.username}</h3>
                  <p className="text-sm text-gray-400">{profile?.email}</p>
                </div>
                {isSelf && (
                  <button onClick={() => setEditing(true)} className="btn-ghost py-1 px-3 text-sm">Düzenle</button>
                )}
              </div>

              {profile?.bio && (
                <p className="text-sm text-gray-300 mt-2">{profile.bio}</p>
              )}

              {profile?.statusMessage && (
                <p className="text-xs text-gray-400 mt-1">💬 {profile.statusMessage}</p>
              )}

              <p className="text-xs text-gray-500 mt-2">
                Son görülme: {profile?.lastSeen ? formatRelativeTime(profile.lastSeen) : 'bilinmiyor'}
              </p>

              {/* Status selector for self */}
              {isSelf && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2">Durum</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleStatusChange(s.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          profile?.status === s.value
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                        }`}
                      >
                        <StatusBadge status={s.value} />
                        <span className={s.color}>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions for other users */}
              {!isSelf && (
                <div className="mt-4 flex gap-2">
                  <button onClick={handleStartDM} className="btn-primary flex-1 py-2 text-sm">Mesaj Gönder</button>
                  <button onClick={handleBlock} className="btn-danger py-2 px-3 text-sm">Engelle</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


