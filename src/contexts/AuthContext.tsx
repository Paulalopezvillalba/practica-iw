import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  isSanctioned: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  isSanctioned: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const isSanctioned = profile?.sanctionedUntil ? new Date(profile.sanctionedUntil) > new Date() : false;

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};
    let unsubscribeSettings: () => void = () => {};

    if (user) {
      setLoading(true);
      // Public profile
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setProfile((prev: any) => ({ ...prev, ...doc.data() }));
        }
        setLoading(false);
      }, (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      // Private settings
      unsubscribeSettings = onSnapshot(doc(db, 'users', user.uid, 'private', 'settings'), (doc) => {
        if (doc.exists()) {
          setProfile((prev: any) => ({ ...prev, ...doc.data() }));
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/private/settings`);
      });
    }

    return () => {
      unsubscribeProfile();
      unsubscribeSettings();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, isSanctioned, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
