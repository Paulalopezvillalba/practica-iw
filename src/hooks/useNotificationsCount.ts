import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useNotificationsCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to unread notifications:", error);
    });

    return () => unsubscribe();
  }, [user]);

  return unreadCount;
};
