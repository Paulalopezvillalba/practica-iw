import { useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useUsageTracker = () => {
  const { user, profile } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    // Track every minute
    intervalRef.current = setInterval(async () => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const logId = `${user.uid}_${dateStr}`;
      const logRef = doc(db, 'usageLogs', logId);

      try {
        const logSnap = await getDoc(logRef);
        if (logSnap.exists()) {
          await updateDoc(logRef, {
            minutesUsed: increment(1)
          });
        } else {
          await setDoc(logRef, {
            userId: user.uid,
            date: dateStr,
            minutesUsed: 1
          });
        }

        // Check if limit exceeded
        if (profile?.usageLimitMinutes && (logSnap.data()?.minutesUsed + 1) >= profile.usageLimitMinutes) {
          // In a real app, we'd show a persistent overlay or block access
          console.warn("Límite de uso diario alcanzado.");
        }
      } catch (error) {
        console.error("Error tracking usage:", error);
      }
    }, 60000); // Every 60 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, profile?.usageLimitMinutes]);
};
