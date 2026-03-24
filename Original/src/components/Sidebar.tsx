import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Logo } from './Logo';
import { 
  Home, 
  Search, 
  PlusSquare, 
  MessageCircle, 
  User, 
  LogOut, 
  ShieldCheck,
  Heart,
  Clock,
  X,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [pendingRequests, setPendingRequests] = useState(0);
  const unreadCount = useUnreadCount();

  useEffect(() => {
    if (!profile?.uid) return;
    const unsubscribe = onSnapshot(collection(db, 'users', profile.uid, 'followRequests'), (snapshot) => {
      setPendingRequests(snapshot.size);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Search, label: 'Buscar', path: '/explore' },
    { icon: MessageCircle, label: 'Mensajes', path: '/messages', badge: unreadCount },
    { icon: Heart, label: 'Notificaciones', path: '/notifications' },
    { icon: UserPlus, label: 'Solicitudes', path: '/follow-requests', badge: pendingRequests },
    { icon: PlusSquare, label: 'Crear', path: '/create' },
    { icon: Clock, label: 'Bienestar', path: '/wellbeing' },
    { icon: User, label: 'Perfil', path: `/profile/${profile?.uid}` },
  ];

  const secondaryItems = [
    { icon: Clock, label: 'Bienestar Digital', path: '/wellbeing' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  const SidebarContent = (
    <div className="h-full w-64 border-r border-gold/20 bg-black flex flex-col p-4">
      <div className="mb-8 px-2 flex items-center justify-between">
        <Logo size="md" variant="gold" />
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-gold/60 hover:text-gold transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {/* Desktop only full nav */}
        <div className="hidden lg:block space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-gold/10 text-gold font-semibold shadow-sm' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-gold'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-lg">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Mobile only secondary nav */}
        <div className="lg:hidden space-y-1">
          <p className="px-4 py-2 text-[10px] font-bold text-gold/40 uppercase tracking-widest">Más opciones</p>
          {secondaryItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={`flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-gold/10 text-gold font-semibold shadow-sm' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-gold'
                }`}
              >
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-lg">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto space-y-2">
        {profile?.role === 'admin' && (
          <Link
            to="/admin"
            onClick={() => onClose()}
            className="flex items-center space-x-4 px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-gold rounded-xl transition-all"
          >
            <ShieldCheck size={24} />
            <span className="text-lg">Moderación</span>
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center space-x-4 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        >
          <LogOut size={24} />
          <span className="text-lg font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen z-50">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen z-[70] lg:hidden"
            >
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
