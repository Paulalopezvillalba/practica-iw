import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusSquare, Heart, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

export const BottomNav: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Search, label: 'Buscar', path: '/explore' },
    { icon: PlusSquare, label: 'Crear', path: '/create' },
    { icon: Heart, label: 'Actividad', path: '/notifications' },
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
            className="relative flex flex-col items-center py-2 px-3 transition-all active:scale-90"
          >
            <item.icon 
              size={22} 
              strokeWidth={isActive ? 2.5 : 1.5} 
              className={`transition-colors ${isActive ? 'text-gold' : 'text-gold/40'}`}
              fill={isActive && item.label !== 'Buscar' && item.label !== 'Crear' ? 'currentColor' : 'none'}
            />
            {isActive && (
              <motion.div 
                layoutId="bottomNavDot"
                className="absolute -bottom-1 w-1 h-1 bg-gold rounded-full"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
