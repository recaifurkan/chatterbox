import api from './axios';

export const roomAPI = {
  getPublicRooms: async (page = 1, limit = 50) => {
    const { data } = await api.get('/rooms', { params: { page, limit } });
    return data;
  },
  getMyRooms: async () => {
    const { data } = await api.get('/rooms/my');
    return data.data.rooms;
  },
  getRoom: async (id) => {
    const { data } = await api.get(`/rooms/${id}`);
    return data.data.room;
  },
  createRoom: async (payload) => {
    const { data } = await api.post('/rooms', payload);
    return data.data.room;
  },
  openDM: async (targetUserId) => {
    const { data } = await api.post('/rooms/dm', { targetUserId });
    return data.data.room;
  },
  joinRoom: async (id, inviteCode) => {
    const { data } = await api.post(`/rooms/${id}/join`, { inviteCode });
    return data.data.room;
  },
  // ...existing code...

  leaveRoom: async (id) => {
    const { data } = await api.post(`/rooms/${id}/leave`);
    return data;
  },
  updateRoom: async (id, payload) => {
    const { data } = await api.put(`/rooms/${id}`, payload);
    return data.data.room;
  },
  deleteRoom: async (id) => {
    const { data } = await api.delete(`/rooms/${id}`);
    return data;
  },
  getMembers: async (id) => {
    const { data } = await api.get(`/rooms/${id}/members`);
    return data.data.members;
  },
  addMember: async (id, userId) => {
    const { data } = await api.post(`/rooms/${id}/members`, { userId });
    return data.data.members;
  },
  promoteUser: async (id, userId, role) => {
    const { data } = await api.patch(`/rooms/${id}/members/role`, { userId, role });
    return data;
  },
};

