import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Heart, MessageCircle, UserPlus, Bell, ChevronRight, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Listen for follow requests count
    const unsubscribeRequests = onSnapshot(
      collection(db, 'users', user.uid, 'followRequests'),
      (snapshot) => {
        setPendingRequestsCount(snapshot.size);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/followRequests`);
      }
    );

    setLoading(false);
    return () => unsubscribeRequests();
  }, [user]);

  const mockNotifications = [
    { id: '1', type: 'like', user: 'maría_rosa', text: 'le ha dado a me gusta a tu foto.', time: new Date(Date.now() - 1000 * 60 * 5) },
    { id: '2', type: 'follow', user: 'carmen_lain', text: 'ha empezado a seguirte.', time: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    { id: '3', type: 'comment', user: 'paco_millan', text: 'comentó: "¡Qué buena foto!"', time: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  ];

  return (
    <div className="p-8 max-w-2xl mx-auto bg-black min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Actividad</h1>
        <p className="text-gold/60">Mantente al día con tus interacciones.</p>
      </header>

      <div className="space-y-2">
        {profile?.isPrivate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/follow-requests')}
            className="flex items-center justify-between p-4 bg-gold/10 rounded-2xl border border-gold/30 hover:bg-gold/20 transition-all cursor-pointer group mb-6"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold text-black rounded-full flex items-center justify-center shadow-lg shadow-gold/20">
                <UserPlus size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Solicitudes de seguimiento</p>
                <p className="text-xs text-gold/60">
                  {pendingRequestsCount > 0 
                    ? `Tienes ${pendingRequestsCount} ${pendingRequestsCount === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`
                    : 'No tienes solicitudes nuevas'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {pendingRequestsCount > 0 && (
                <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
              )}
              <ChevronRight size={18} className="text-gold group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        )}

        {mockNotifications.map((notif) => (
          <motion.div 
            key={notif.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between p-4 bg-black-soft rounded-2xl border border-gold/20 hover:bg-gold/10 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                notif.type === 'like' ? 'bg-rose-500/10 text-rose-500' : 
                notif.type === 'follow' ? 'bg-gold/10 text-gold' : 'bg-gold/10 text-gold'
              }`}>
                {notif.type === 'like' ? <Heart size={20} fill="currentColor" /> : 
                 notif.type === 'follow' ? <UserPlus size={20} /> : <MessageCircle size={20} />}
              </div>
              <div>
                <p className="text-sm text-white">
                  <span className="font-bold text-gold">@{notif.user}</span> {notif.text}
                </p>
                <p className="text-xs text-gold/40 mt-0.5">
                  {formatDistanceToNow(notif.time, { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gold/20 group-hover:text-gold transition-colors" />
          </motion.div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-gold/5 rounded-3xl border border-gold/10 text-center">
        <Bell size={32} className="mx-auto text-gold mb-4" />
        <h3 className="text-lg font-bold text-gold mb-2">Notificaciones en tiempo real</h3>
        <p className="text-gold/60 text-sm leading-relaxed">
          "Original" te avisará de nuevas interacciones solo cuando sea relevante, para evitar la sobreestimulación constante.
        </p>
      </div>
    </div>
  );
};
