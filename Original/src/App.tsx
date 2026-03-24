import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { CreatePost } from './pages/CreatePost';
import { WellbeingPage } from './pages/WellbeingPage';
import { ExplorePage } from './pages/ExplorePage';
import { MessagesPage } from './pages/MessagesPage';
import { MessageRequestsPage } from './pages/MessageRequestsPage';
import { ChatWindow } from './pages/ChatWindow';
import { FollowRequestsPage } from './pages/FollowRequestsPage';
import { FollowsListPage } from './pages/FollowsListPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useUsageTracker } from './hooks/useUsageTracker';
import { useUnreadCount } from './hooks/useUnreadCount';
import { Menu, MessageCircle } from 'lucide-react';
import { Logo } from './components/Logo';
import { BottomNav } from './components/BottomNav';
import { Link } from 'react-router-dom';

export default function App() {
  const { user, loading, isAuthReady } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const unreadCount = useUnreadCount();
  useUsageTracker();

  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  const isChatWindow = location.pathname.startsWith('/messages/');

  return (
    <ErrorBoundary>
      {!user ? (
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      ) : (
        <div className="min-h-screen bg-black flex flex-col lg:flex-row">
          {/* Mobile Header */}
          {!isChatWindow && (
            <header className="lg:hidden h-16 glass border-b border-gold/20 flex items-center justify-between px-4 sticky top-0 z-50">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-gold/60 hover:text-gold transition-colors active:scale-90"
              >
                <Menu size={22} />
              </button>
              <div className="scale-90">
                <Logo size="sm" variant="gold" />
              </div>
              <Link 
                to="/messages"
                className="p-2 text-gold/60 hover:text-gold transition-colors active:scale-90 relative"
              >
                <MessageCircle size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-black">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </header>
          )}

          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          
          <main className={`flex-1 lg:ml-64 min-h-screen ${!isChatWindow ? 'pb-20 lg:pb-0' : ''}`}>
            <div className={`max-w-4xl mx-auto ${isChatWindow ? '' : 'px-4 lg:px-8 py-6 lg:py-10'}`}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/requests" element={<MessageRequestsPage />} />
                <Route path="/messages/:chatId" element={<ChatWindow />} />
                <Route path="/follow-requests" element={<FollowRequestsPage />} />
                <Route path="/profile/:id/follows" element={<FollowsListPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile/:id" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/create" element={<CreatePost />} />
                <Route path="/wellbeing" element={<WellbeingPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>

          {/* Mobile Bottom Nav */}
          {!isChatWindow && <BottomNav />}
        </div>
      )}
    </ErrorBoundary>
  );
}
