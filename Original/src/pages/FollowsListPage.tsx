import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, doc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { UserMinus, UserX, ChevronLeft, Search, User } from 'lucide-react';

interface FollowUser {
  uid: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  followedAt?: string;
}

export const FollowsListPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') === 'following' ? 'following' : 'followers';
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileName, setProfileName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch profile info
    getDoc(doc(db, 'users', id)).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfileName(data.username || 'Usuario');
        setIsPrivate(data.isPrivate || false);
      }
    });

    // Check if following
    const followCheckRef = doc(db, 'users', id, 'followers', user.uid);
    const unsubscribeFollow = onSnapshot(followCheckRef, (doc) => {
      setIsFollowing(doc.exists());
    });

    const collectionRef = collection(db, 'users', id, type);
    const unsubscribe = onSnapshot(collectionRef, async (snapshot) => {
      const followData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch full user details for each follow
      const detailedUsers = await Promise.all(
        followData.map(async (item: any) => {
          const userDoc = await getDoc(doc(db, 'users', item.uid));
          if (userDoc.exists()) {
            return {
              ...item,
              ...userDoc.data()
            };
          }
          return item;
        })
      );

      setUsers(detailedUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${id}/${type}`);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeFollow();
    };
  }, [id, type, user]);

  const handleRemoveFollower = async (followerId: string) => {
    if (!user || user.uid !== id) return;
    
    setProcessingId(followerId);
    try {
      const batch = writeBatch(db);
      
      // 1. Remove from my followers
      batch.delete(doc(db, 'users', user.uid, 'followers', followerId));
      
      // 2. Remove from their following
      batch.delete(doc(db, 'users', followerId, 'following', user.uid));
      
      await batch.commit();
    } catch (error) {
      console.error("Error removing follower:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnfollow = async (followedId: string) => {
    if (!user || user.uid !== id) return;

    setProcessingId(followedId);
    try {
      const batch = writeBatch(db);
      
      // 1. Remove from my following
      batch.delete(doc(db, 'users', user.uid, 'following', followedId));
      
      // 2. Remove from their followers
      batch.delete(doc(db, 'users', followedId, 'followers', user.uid));
      
      await batch.commit();
    } catch (error) {
      console.error("Error unfollowing:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isOwnProfile = user?.uid === id;
  const canSeeList = isOwnProfile || !isPrivate || isFollowing;

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 glass border-b border-gold/20 p-4 flex items-center space-x-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-gold hover:bg-gold/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">
            {type === 'following' ? 'Seguidos' : 'Seguidores'}
          </h1>
          <p className="text-xs text-gold/60">@{profileName}</p>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {!canSeeList ? (
          <div className="text-center py-20 bg-black-soft rounded-3xl border border-dashed border-gold/20">
            <User size={48} className="mx-auto text-gold/20 mb-4" />
            <h3 className="text-xl font-bold text-gold mb-2">Esta cuenta es privada</h3>
            <p className="text-gold/60 max-w-xs mx-auto">
              Sigue a esta cuenta para ver sus seguidores y seguidos.
            </p>
          </div>
        ) : (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={18} />
              <input 
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black-soft rounded-xl border border-gold/20 text-white focus:ring-1 focus:ring-gold outline-none transition-all"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <motion.div
                        key={u.uid}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-3 bg-black-soft/50 rounded-2xl border border-gold/5 hover:border-gold/20 transition-all group"
                      >
                        <div 
                          className="flex items-center space-x-3 cursor-pointer flex-1"
                          onClick={() => navigate(`/profile/${u.uid}`)}
                        >
                          <img 
                            src={u.photoURL || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                            alt={u.username}
                            className="w-12 h-12 rounded-full object-cover border border-gold/10"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h3 className="font-bold text-white text-sm">@{u.username}</h3>
                            <p className="text-xs text-gold/40">{u.displayName}</p>
                          </div>
                        </div>

                        {isOwnProfile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              type === 'following' ? handleUnfollow(u.uid) : handleRemoveFollower(u.uid);
                            }}
                            disabled={processingId === u.uid}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title={type === 'following' ? 'Dejar de seguir' : 'Eliminar seguidor'}
                          >
                            {processingId === u.uid ? (
                              <div className="animate-spin h-5 w-5 border-2 border-rose-500 border-t-transparent rounded-full" />
                            ) : (
                              type === 'following' ? <UserMinus size={20} /> : <UserX size={20} />
                            )}
                          </button>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-20">
                      <User size={48} className="mx-auto text-gold/10 mb-4" />
                      <p className="text-gold/40">No se encontraron usuarios.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
