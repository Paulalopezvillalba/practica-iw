import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserCard } from '../components/UserCard';
import { Search, Sparkles, Hash } from 'lucide-react';

export const ExplorePage: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribeFollowing = onSnapshot(collection(db, 'users', user.uid, 'following'), (snapshot) => {
      setFollowingIds(new Set(snapshot.docs.map(doc => doc.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/following`);
    });

    // Listen to follow requests sent BY the user
    // Since we don't have a global 'sentRequests', we'd need to check each target.
    // This is tricky. Let's assume for now we only know if we follow.
    // Alternatively, we can query all followRequests where requesterId == user.uid
    // But that requires a collectionGroup query or a top-level collection.
    // Let's stick to the subcollection for now and handle the UI state locally after clicking.
    
    return () => unsubscribeFollowing();
  }, [user]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '>=', searchTerm.toLowerCase()),
          where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        setResults(snapshot.docs.map(doc => doc.data()).filter(u => u.uid !== user?.uid));
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, user]);

  const handleFollow = async (targetUser: any) => {
    if (!user) return;
    const isFollowing = followingIds.has(targetUser.uid);
    const isRequested = requestedIds.has(targetUser.uid);
    
    const followingRef = doc(db, 'users', user.uid, 'following', targetUser.uid);
    const followerRef = doc(db, 'users', targetUser.uid, 'followers', user.uid);
    const requestRef = doc(db, 'users', targetUser.uid, 'followRequests', user.uid);

    try {
      if (isFollowing) {
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
      } else if (isRequested) {
        await deleteDoc(requestRef);
        setRequestedIds(prev => {
          const next = new Set(prev);
          next.delete(targetUser.uid);
          return next;
        });
      } else {
        if (targetUser.isPrivate) {
          await setDoc(requestRef, {
            requesterId: user.uid,
            requesterName: user.displayName || user.email?.split('@')[0],
            requesterPhoto: user.photoURL,
            targetId: targetUser.uid,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          setRequestedIds(prev => new Set(prev).add(targetUser.uid));
        } else {
          await setDoc(followingRef, { uid: targetUser.uid, followedAt: new Date().toISOString() });
          await setDoc(followerRef, { uid: user.uid, followedAt: new Date().toISOString() });
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  return (
    <div className="p-8 bg-black min-h-screen">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-6">Explorar</h1>
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={20} />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuarios o hashtags..."
            className="w-full pl-12 pr-4 py-4 bg-black-soft rounded-2xl border border-gold/20 text-white focus:ring-2 focus:ring-gold outline-none shadow-2xl transition-all placeholder:text-slate-600"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-gold/40">Buscando...</div>
        ) : results.length > 0 ? (
          results.map(u => (
            <UserCard 
              key={u.uid} 
              user={u} 
              isFollowing={followingIds.has(u.uid)}
              isRequested={requestedIds.has(u.uid)}
              onFollow={() => handleFollow(u)}
            />
          ))
        ) : searchTerm ? (
          <div className="col-span-2 text-center py-12 text-gold/40">No se encontraron resultados.</div>
        ) : (
          <div className="col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <Sparkles size={20} className="text-gold" />
                <span>Sugerencias para ti</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p className="text-gold/40 text-sm italic">Busca a tus amigos para empezar a conectar.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <Hash size={20} className="text-gold" />
                <span>Hashtags populares</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {['#bienestar', '#original', '#saludmental', '#fotografia', '#naturaleza'].map(tag => (
                  <button key={tag} className="px-4 py-2 bg-black-soft border border-gold/20 text-gold rounded-xl font-semibold hover:bg-gold/10 transition-colors">
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
