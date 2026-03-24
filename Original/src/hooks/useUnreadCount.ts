import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useUnreadCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Query chats where the user is a participant
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const lastReadAt = data.lastReadAt?.[user.uid] || '0';
        const lastMessageAt = data.lastMessageAt || '0';

        if (lastMessageAt > lastReadAt) {
          count++;
        }
      });
      setUnreadCount(count);
    }, (error) => {
      console.error("Error listening to unread chats:", error);
    });

    return () => unsubscribe();
  }, [user]);

  return unreadCount;
};
