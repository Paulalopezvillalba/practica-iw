import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import { PostPage } from './pages/PostPage';
import { useUsageTracker } from './hooks/useUsageTracker';
import { useUnreadCount } from './hooks/useUnreadCount';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, MessageCircle, Ban, Timer, Coffee, ArrowLeft, Clock, ShieldAlert } from 'lucide-react';
import { Logo } from './components/Logo';
import { BottomNav } from './components/BottomNav';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const WellbeingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOverLimit, minutesToday } = useUsageTracker();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Allow access to wellbeing and settings even when blocked
  const isWhitelisted = location.pathname === '/wellbeing' || location.pathname === '/settings';

  if (isOverLimit && !isWhitelisted) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-center space-y-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6 max-w-sm"
        >
          <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Ban size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Límite alcanzado</h1>
            <p className="text-gold/40 font-medium">Has usado Original por {minutesToday} minutos hoy. Tu límite es de {profile?.usageLimitMinutes} minutos.</p>
          </div>
          <div className="p-6 bg-gold/5 rounded-3xl border border-gold/10 space-y-4">
            <div className="flex items-center space-x-3 text-gold">
              <Coffee size={20} />
              <span className="text-sm font-bold uppercase tracking-widest">Es hora de un descanso</span>
            </div>
            <p className="text-gold/60 text-xs leading-relaxed text-left">
              El bienestar digital es nuestra prioridad. Tómate un tiempo para ti fuera de la pantalla. Volveremos a estar aquí mañana.
            </p>
          </div>
          <div className="flex flex-col space-y-3">
            <button 
              onClick={() => navigate('/wellbeing')}
              className="w-full py-4 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all flex items-center justify-center space-x-2"
            >
              <Timer size={20} />
              <span>Gestionar límites</span>
            </button>
            <button 
              onClick={() => signOut()}
              className="w-full py-4 bg-black border border-gold/20 text-gold rounded-2xl font-bold hover:bg-white/5 transition-all"
            >
              Cerrar sesión
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

const SanctionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSanctioned, profile, signOut } = useAuth();
  const location = useLocation();

  // Allow access to settings even when sanctioned
  const isWhitelisted = location.pathname === '/settings';

  if (isSanctioned && !isWhitelisted) {
    const sanctionedUntilDate = profile?.sanctionedUntil ? new Date(profile.sanctionedUntil) : null;
    const formattedDate = sanctionedUntilDate ? format(sanctionedUntilDate, "d 'de' MMMM 'a las' HH:mm", { locale: es }) : 'próximamente';

    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-center space-y-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6 max-w-sm"
        >
          <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Cuenta Restringida</h1>
            <p className="text-gold/40 font-medium">Tu cuenta ha sido sancionada temporalmente por incumplir las normas de la comunidad.</p>
          </div>
          <div className="p-6 bg-gold/5 rounded-3xl border border-gold/10 space-y-4">
            <div className="flex items-center space-x-3 text-gold">
              <Clock size={20} />
              <span className="text-sm font-bold uppercase tracking-widest">Fin de la sanción</span>
            </div>
            <p className="text-gold text-sm font-bold">
              {formattedDate}
            </p>
          </div>
          <div className="flex flex-col space-y-3">
            <button 
              onClick={() => signOut()}
              className="w-full py-4 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all"
            >
              Cerrar sesión
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const { user, loading, isAuthReady } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const unreadCount = useUnreadCount();
  // useUsageTracker is now called inside WellbeingGuard

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
            <header className="lg:hidden pt-safe glass border-b border-gold/20 flex items-center justify-between px-4 sticky top-0 z-50">
              <div className="h-16 flex items-center justify-between w-full">
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
              </div>
            </header>
          )}

          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          
          <main className={`flex-1 lg:ml-64 min-h-screen ${!isChatWindow ? 'pb-20 lg:pb-0' : ''}`}>
            <div className={`max-w-4xl mx-auto ${isChatWindow ? '' : 'px-4 lg:px-8 py-6 lg:py-10'}`}>
              <WellbeingGuard>
                <SanctionGuard>
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
                    <Route path="/post/:id" element={<PostPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/create" element={<CreatePost />} />
                    <Route path="/wellbeing" element={<WellbeingPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </SanctionGuard>
              </WellbeingGuard>
            </div>
          </main>

          {/* Mobile Bottom Nav */}
          {!isChatWindow && <BottomNav />}
        </div>
      )}
    </ErrorBoundary>
  );
}
