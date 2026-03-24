import api from './axios';

export const uploadAPI = {
  uploadFiles: async (files, onProgress) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const { data } = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => onProgress(Math.round((e.loaded * 100) / e.total))
        : undefined,
    });
    return data.data.files;
  },
};

export const userAPI = {
  getProfile: async (userId) => {
    const { data } = await api.get(`/users/${userId}`);
    return data.data.user;
  },
  updateProfile: async (updates) => {
    const { data } = await api.put('/users/me', updates);
    return data.data.user;
  },
  uploadAvatar: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress ? (e) => onProgress(Math.round((e.loaded * 100) / e.total)) : undefined,
    });
    return data.data.avatarUrl;
  },
  setStatus: async (status, statusMessage) => {
    const { data } = await api.patch('/users/me/status', { status, statusMessage });
    return data.data;
  },
  blockUser: async (userId) => api.post(`/users/${userId}/block`),
  unblockUser: async (userId) => api.delete(`/users/${userId}/block`),
  muteUser: async (userId) => api.post(`/users/${userId}/mute`),
  searchUsers: async (q) => {
    const { data } = await api.get('/users/search', { params: { q } });
    return data.data.users;
  },
};

export const notificationAPI = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/notifications', { params });
    return data.data;
  },
  markRead: async (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: async () => api.patch('/notifications/read-all'),
  delete: async (id) => api.delete(`/notifications/${id}`),
};

export const scheduledAPI = {
  list: async () => {
    const { data } = await api.get('/scheduled');
    return data.data.messages;
  },
  create: async (payload) => {
    const { data } = await api.post('/scheduled', payload);
    return data.data.message;
  },
  cancel: async (id) => api.delete(`/scheduled/${id}`),
};

