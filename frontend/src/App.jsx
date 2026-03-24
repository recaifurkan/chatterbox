import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useSocketStore } from './store/socketStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';

function ProtectedRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user } = useAuthStore();
  return !user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, accessToken } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    if (user && accessToken) {
      connect(accessToken);
    } else {
      disconnect();
    }
    return () => {};
  }, [user, accessToken]);

  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/*" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
    </Routes>
  );
}

