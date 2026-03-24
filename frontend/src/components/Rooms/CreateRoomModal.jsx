import { useState } from 'react';
import { roomAPI } from '../../api/room.api';
import { useChatStore } from '../../store/chatStore';
import { useSocketStore } from '../../store/socketStore';
import toast from 'react-hot-toast';

export default function CreateRoomModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', type: 'public' });
  const [loading, setLoading] = useState(false);
  const { addOrUpdateRoom, setActiveRoom } = useChatStore();
  const { emit } = useSocketStore();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Oda adı gerekli');
    setLoading(true);
    try {
      const room = await roomAPI.createRoom(form);
      addOrUpdateRoom(room);
      setActiveRoom(room._id);
      emit('join_room', { roomId: room._id });
      toast.success(`#${room.name} odası oluşturuldu`);
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Oda oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Yeni Oda Oluştur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Oda Adı *</label>
            <input
              type="text"
              className="input-field"
              placeholder="genel, teknoloji, duyurular..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Açıklama</label>
            <input
              type="text"
              className="input-field"
              placeholder="Bu oda ne için?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Oda Türü</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'public', label: 'Genel', icon: '🌐', desc: 'Herkes katılabilir' },
                { value: 'private', label: 'Özel', icon: '🔒', desc: 'Davet ile katılır' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: opt.value })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.type === opt.value
                      ? 'border-blue-500 bg-blue-600/20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-lg mb-1">{opt.icon}</div>
                  <div className="text-sm font-medium text-white">{opt.label}</div>
                  <div className="text-xs text-gray-400">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">İptal</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

