import { create } from 'zustand';

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  activeModal: null,
  modalData: null,
  searchOpen: false,
  rightPanelOpen: false,
  activeSidebarTab: 'rooms', // 'rooms' | 'dms'

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setSidebarTab: (tab) => set({ activeSidebarTab: tab }),
}));

