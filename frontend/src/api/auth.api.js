import api from './axios';

export const authAPI = {
  register: async (username, email, password) => {
    const { data } = await api.post('/auth/register', { username, email, password });
    return data.data;
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data.data;
  },
  logout: async () => {
    const { data } = await api.post('/auth/logout');
    return data;
  },
  refresh: async (refreshToken) => {
    const { data } = await api.post('/auth/refresh', { refreshToken });
    return data.data;
  },
  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data.data;
  },
};

