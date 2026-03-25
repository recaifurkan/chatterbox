import { useState, useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import { useChatStore } from '../store/chatStore';
import { useSocketStore } from '../store/socketStore';
import { roomAPI } from '../api/room.api';
import Sidebar from '../components/Sidebar/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import WelcomeScreen from '../components/Chat/WelcomeScreen';
import CreateRoomModal from '../components/Rooms/CreateRoomModal';
import BrowseRoomsModal from '../components/Rooms/BrowseRoomsModal';
import InviteModal from '../components/Rooms/InviteModal';
import UserProfileModal from '../components/User/UserProfileModal';
import SearchPanel from '../components/Chat/SearchPanel';
import NotificationBell from '../components/Notifications/NotificationBell';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { activeModal, closeModal, modalData, sidebarOpen, toggleSidebar } = useUIStore();
  const { activeRoomId, rooms, setRooms } = useChatStore();
  const { emit } = useSocketStore();

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    try {
      const r = await roomAPI.getMyRooms();
      setRooms(r);
    } catch { toast.error('Odalar yüklenemedi'); }
  }

  // Invite modalı için aktif odayı bul
  const activeRoom = rooms.find((r) => r._id === activeRoomId) || null;

  return (
    <div className="h-dvh flex bg-gray-900 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-30 md:z-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex-shrink-0
      `}>
        <Sidebar onRoomSelect={() => {
          if (window.innerWidth < 768) toggleSidebar();
        }} />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* ── Mobil: sabit üst bar — sadece aktif sohbet yokken gösterilir ── */}
        {!activeRoomId && (
          <div className="flex-shrink-0 md:hidden h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3 z-10">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="font-bold text-white text-base truncate">Chatterbox</span>
            </div>
            <NotificationBell />
          </div>
        )}

        {activeRoomId ? <ChatWindow /> : <WelcomeScreen />}
      </div>

      {/* Modals */}
      {activeModal === 'createRoom'  && <CreateRoomModal onClose={closeModal} onCreated={loadRooms} />}
      {activeModal === 'browseRooms' && <BrowseRoomsModal onClose={closeModal} />}
      {activeModal === 'invite'      && activeRoom && <InviteModal room={activeRoom} onClose={closeModal} />}
      {activeModal === 'userProfile' && <UserProfileModal onClose={closeModal} />}
      {activeModal === 'search'      && <SearchPanel onClose={closeModal} />}
    </div>
  );
}
