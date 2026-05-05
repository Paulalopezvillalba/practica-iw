import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, doc, setDoc, deleteDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserCard } from '../components/UserCard';
import { PostCard } from '../components/PostCard';
import { Search, Sparkles, Hash, User as UserIcon } from 'lucide-react';

export const ExplorePage: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [postResults, setPostResults] = useState<any[]>([]);
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
    const handleSearch = async () => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) {
        setUserResults([]);
        setPostResults([]);
        return;
      }
      setLoading(true);
      try {
        // Search Users
        const userTerm = term.startsWith('@') ? term.slice(1) : term;
        const userQuery = query(
          collection(db, 'users'),
          where('username', '>=', userTerm),
          where('username', '<=', userTerm + '\uf8ff'),
          limit(10)
        );
        const userSnapshot = await getDocs(userQuery);
        setUserResults(userSnapshot.docs.map(doc => doc.data()).filter(u => u.uid !== user?.uid));

        // Search Hashtags
        const hashtagTerm = term.startsWith('#') ? term : `#${term}`;
        const postQuery = query(
          collection(db, 'posts'),
          where('hashtags', 'array-contains', hashtagTerm),
          where('status', '==', 'active'),
          limit(10)
        );
        const postSnapshot = await getDocs(postQuery);
        setPostResults(postSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      } catch (error) {
        console.error("Error searching:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(handleSearch, 300);
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
    <div className="pt-safe pb-8 px-8 bg-black min-h-screen">
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

      <div className="space-y-12">
        {loading ? (
          <div className="text-center py-12 text-gold/40 flex flex-col items-center space-y-4">
            <Sparkles className="animate-pulse text-gold" size={32} />
            <p className="font-medium">Buscando en la red...</p>
          </div>
        ) : searchTerm ? (
          <div className="space-y-12">
            {/* User Results */}
            <section>
              <h2 className="text-lg font-bold text-white mb-6 flex items-center space-x-2">
                <UserIcon size={20} className="text-gold" />
                <span>Usuarios</span>
              </h2>
              {userResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userResults.map(u => (
                    <UserCard 
                      key={u.uid} 
                      user={u} 
                      isFollowing={followingIds.has(u.uid)}
                      isRequested={requestedIds.has(u.uid)}
                      onFollow={() => handleFollow(u)}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-black-soft p-8 rounded-3xl border border-gold/10 text-center">
                  <p className="text-gold/40">Usuario <span className="text-gold font-bold">'{searchTerm.replace(/^[@#]/, '')}'</span> no encontrado</p>
                </div>
              )}
            </section>

            {/* Hashtag Results */}
            <section>
              <h2 className="text-lg font-bold text-white mb-6 flex items-center space-x-2">
                <Hash size={20} className="text-gold" />
                <span>Publicaciones</span>
              </h2>
              {postResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {postResults.map(p => (
                    <PostCard 
                      key={p.id} 
                      post={p} 
                      onHashtagClick={(tag) => setSearchTerm(tag)}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-black-soft p-8 rounded-3xl border border-gold/10 text-center">
                  <p className="text-gold/40"><span className="text-gold font-bold">#{searchTerm.replace(/^[@#]/, '')}</span> no tiene resultados</p>
                </div>
              )}
            </section>
          </div>
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
                  <button 
                    key={tag} 
                    onClick={() => setSearchTerm(tag)}
                    className="px-4 py-2 bg-black-soft border border-gold/20 text-gold rounded-xl font-semibold hover:bg-gold/10 transition-colors"
                  >
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
