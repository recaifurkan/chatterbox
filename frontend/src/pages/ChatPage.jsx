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
    <div className="h-screen flex bg-gray-900 overflow-hidden">
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
      <div className="flex-1 flex flex-col min-w-0">
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
