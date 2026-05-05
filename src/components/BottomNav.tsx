import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusSquare, Heart, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationsCount } from '../hooks/useNotificationsCount';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { motion } from 'motion/react';

export const BottomNav: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const notificationsCount = useNotificationsCount();
  const unreadCount = useUnreadCount();

  const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Search, label: 'Buscar', path: '/explore' },
    { icon: PlusSquare, label: 'Crear', path: '/create' },
    { icon: Heart, label: 'Actividad', path: '/notifications', badge: notificationsCount },
    { icon: User, label: 'Perfil', path: `/profile/${profile?.uid}` },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-gold/20 px-6 py-3 flex items-center justify-between z-50 pb-safe">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className="relative flex flex-col items-center py-2 px-3 transition-all"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="relative"
            >
              <item.icon 
                size={22} 
                strokeWidth={isActive ? 2 : 1.5} 
                className={`transition-all duration-300 ${isActive ? 'text-gold drop-shadow-[0_0_5px_rgba(212,175,55,0.3)]' : 'text-gold/40'}`}
              />
              {item.badge !== undefined && item.badge > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-rose-500 text-white text-[7px] font-bold min-w-[12px] h-[12px] flex items-center justify-center rounded-full border border-black"
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </motion.span>
              )}
            </motion.div>
            {isActive && (
              <motion.div 
                layoutId="bottomNavDot"
                className="absolute -bottom-0.5 w-1 h-1 bg-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
