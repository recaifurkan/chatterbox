import api from './axios';

export const messageAPI = {
  getMessages: async (roomId, params = {}) => {
    const { data } = await api.get(`/messages/room/${roomId}`, { params });
    return data;
  },
  editMessage: async (id, content) => {
    const { data } = await api.put(`/messages/${id}`, { content });
    return data.data.message;
  },
  deleteMessage: async (id) => {
    const { data } = await api.delete(`/messages/${id}`);
    return data;
  },
  markRead: async (roomId, messageIds) => {
    const { data } = await api.post(`/messages/room/${roomId}/read`, { messageIds });
    return data;
  },
  addReaction: async (id, emoji) => {
    const { data } = await api.post(`/messages/${id}/reactions`, { emoji });
    return data;
  },
  removeReaction: async (id, emoji) => {
    const { data } = await api.delete(`/messages/${id}/reactions/${encodeURIComponent(emoji)}`);
    return data;
  },
  getAuditLog: async (messageId) => {
    const { data } = await api.get(`/messages/${messageId}/audit`);
    return data.data.logs;
  },
};

export const searchAPI = {
  searchMessages: async (params) => {
    const { data } = await api.get('/search/messages', { params });
    return data;
  },
};

