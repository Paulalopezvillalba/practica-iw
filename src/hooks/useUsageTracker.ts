import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useUsageTracker = () => {
  const { user, profile } = useAuth();
  const [minutesToday, setMinutesToday] = useState(0);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const logId = `${user.uid}_${todayStr}`;
    const logRef = doc(db, 'usageLogs', logId);

    // Listen to today's usage
    const unsubscribe = onSnapshot(logRef, (snap) => {
      if (snap.exists()) {
        setMinutesToday(snap.data().minutesUsed || 0);
      }
    });

    // Track every minute
    intervalRef.current = setInterval(async () => {
      try {
        const logSnap = await getDoc(logRef);
        if (logSnap.exists()) {
          await updateDoc(logRef, {
            minutesUsed: increment(1)
          });
        } else {
          await setDoc(logRef, {
            userId: user.uid,
            date: todayStr,
            minutesUsed: 1
          });
        }
      } catch (error) {
        console.error("Error tracking usage:", error);
      }
    }, 60000); // Every 60 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      unsubscribe();
    };
  }, [user]);

  const isOverLimit = profile?.usageLimitMinutes && minutesToday >= profile.usageLimitMinutes;

  return { minutesToday, isOverLimit };
};
