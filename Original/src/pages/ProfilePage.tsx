import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, updateDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Grid, UserPlus, Check, Edit3, MessageCircle, Heart, Lock, Clock, UserMinus, ShieldAlert } from 'lucide-react';
import { ReportModal } from '../components/ReportModal';

interface Post {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  description?: string;
  expiresAt?: string | null;
  status: 'active' | 'archived';
  likesCount?: number;
  commentsCount?: number;
  createdAt: string;
}

export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile: currentUserProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'archive'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const navigate = useNavigate();

  const isOwnProfile = user?.uid === id;
  const canSeePosts = isOwnProfile || !profile?.isPrivate || isFollowing;

  useEffect(() => {
    if (!id || !user) return;

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Listeners for follow status and counts
    const unsubFollowing = onSnapshot(doc(db, 'users', user.uid, 'following', id), (doc) => {
      setIsFollowing(doc.exists());
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/following/${id}`));

    const unsubRequested = onSnapshot(doc(db, 'users', id, 'followRequests', user.uid), (doc) => {
      setIsRequested(doc.exists());
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${id}/followRequests/${user.uid}`));

    const unsubFollowers = onSnapshot(collection(db, 'users', id, 'followers'), (snapshot) => {
      setFollowersCount(snapshot.size);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${id}/followers`));

    const unsubFollowingCount = onSnapshot(collection(db, 'users', id, 'following'), (snapshot) => {
      setFollowingCount(snapshot.size);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${id}/following`));

    return () => {
      unsubFollowing();
      unsubRequested();
      unsubFollowers();
      unsubFollowingCount();
    };
  }, [id, user]);

  useEffect(() => {
    if (!id || !canSeePosts) {
      setPosts([]);
      setArchivedPosts([]);
      return;
    }

    // Fetch all posts from this author (both active and archived)
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)) as Post[];
      const now = new Date();
      
      // Active: status is active AND (no expiry OR not yet expired)
      const active = allPosts.filter(p => 
        p.status === 'active' && (!p.expiresAt || new Date(p.expiresAt) > now)
      );
      
      // Archived: status is archived OR (status is active AND expired)
      const archived = allPosts.filter(p => 
        p.status === 'archived' || (p.status === 'active' && p.expiresAt && new Date(p.expiresAt) <= now)
      );
      
      setPosts(active);
      setArchivedPosts(archived);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));

    return () => unsubscribePosts();
  }, [id, canSeePosts]);

  const handleFollow = async () => {
    if (!user || !profile) return;

    const followingRef = doc(db, 'users', user.uid, 'following', id);
    const followerRef = doc(db, 'users', id, 'followers', user.uid);
    const requestRef = doc(db, 'users', id, 'followRequests', user.uid);

    try {
      if (isFollowing) {
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
      } else if (isRequested) {
        await deleteDoc(requestRef);
      } else {
        if (profile.isPrivate) {
          await setDoc(requestRef, {
            requesterId: user.uid,
            requesterName: currentUserProfile?.username || user.email?.split('@')[0],
            requesterPhoto: user.photoURL,
            targetId: id,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
        } else {
          await setDoc(followingRef, { uid: id, followedAt: new Date().toISOString() });
          await setDoc(followerRef, { uid: user.uid, followedAt: new Date().toISOString() });

          // Create notification for followed user
          await addDoc(collection(db, 'users', id, 'notifications'), {
            type: 'follow',
            fromUserId: user.uid,
            fromUserName: currentUserProfile?.username || user.displayName || 'usuario',
            fromUserPhoto: currentUserProfile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=random`,
            text: 'ha empezado a seguirte',
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-gold bg-black min-h-screen">Cargando perfil...</div>;
  if (!profile) return <div className="p-8 text-center text-gold bg-black min-h-screen">Usuario no encontrado.</div>;

  return (
    <div className="pt-safe pb-24 px-4 lg:px-8 bg-black min-h-screen">
      <header className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-12 mb-8 lg:mb-16">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-tr from-gold-dark via-gold to-gold-light rounded-full opacity-20 blur-sm group-hover:opacity-40 transition-opacity" />
          <div className="relative p-0.5 lg:p-1 rounded-full bg-gradient-to-tr from-gold-dark via-gold to-gold-light shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <img 
              src={profile.photoURL} 
              alt={profile.username} 
              className="w-24 h-24 md:w-32 md:h-32 lg:w-44 lg:h-44 rounded-full object-cover border-2 lg:border-4 border-black shadow-2xl"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${profile.username}&background=random`;
              }}
            />
          </div>
          {isOwnProfile && (
            <button 
              onClick={() => navigate('/settings')}
              className="absolute bottom-1 right-1 md:bottom-2 md:right-2 lg:bottom-4 lg:right-4 p-2 lg:p-3 bg-gold text-black rounded-full shadow-xl hover:bg-gold-light transition-all active:scale-90 z-10"
            >
              <Edit3 size={14} className="md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px]" />
            </button>
          )}
        </div>

        <div className="flex-1 w-full text-center md:text-left pt-2">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 mb-6 lg:mb-8">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight">@{profile.username}</h2>
            {isOwnProfile ? (
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => navigate('/settings')}
                  className="px-6 lg:px-8 py-2 lg:py-2.5 bg-gold/10 border border-gold/20 rounded-full font-bold text-xs lg:text-sm text-gold hover:bg-gold/20 transition-all active:scale-95"
                >
                  Editar perfil
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="p-2.5 text-gold/60 hover:text-gold transition-colors active:scale-90 rounded-full hover:bg-gold/10"
                >
                  <Settings size={20} className="lg:w-7 lg:h-7" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button 
                  onClick={handleFollow}
                  className={`px-8 py-2 lg:py-2.5 rounded-full font-bold text-xs lg:text-sm transition-all shadow-lg flex items-center space-x-2 active:scale-95 ${
                    isFollowing 
                      ? 'bg-black-soft border border-gold/20 text-gold hover:bg-gold/10' 
                      : isRequested
                        ? 'bg-black-soft border border-gold/20 text-gold/40'
                        : 'bg-gold text-black hover:bg-gold-light shadow-gold/30'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus size={16} />
                      <span>Siguiendo</span>
                    </>
                  ) : isRequested ? (
                    <>
                      <Clock size={16} />
                      <span>Solicitado</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Seguir</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="p-2.5 text-rose-500/40 hover:text-rose-500 transition-colors active:scale-90 rounded-full hover:bg-rose-500/10"
                  title="Reportar usuario"
                >
                  <ShieldAlert size={20} className="lg:w-7 lg:h-7" />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-around md:justify-start md:space-x-8 mb-4 lg:mb-6 border-y border-gold/5 py-3 md:border-none md:py-0">
            <div className="text-center md:text-left">
              <span className="block md:inline font-bold text-white text-sm lg:text-base">{posts.length}</span> 
              <span className="text-gold/40 md:text-gold/60 text-[9px] lg:text-sm uppercase md:lowercase md:ml-1 tracking-widest md:tracking-normal">publicaciones</span>
            </div>
            <button 
              onClick={() => navigate(`/profile/${id}/follows?type=followers`)}
              className="text-center md:text-left hover:opacity-80 transition-opacity active:scale-95"
            >
              <span className="block md:inline font-bold text-white text-sm lg:text-base">{followersCount}</span> 
              <span className="text-gold/40 md:text-gold/60 text-[9px] lg:text-sm uppercase md:lowercase md:ml-1 tracking-widest md:tracking-normal">seguidores</span>
            </button>
            <button 
              onClick={() => navigate(`/profile/${id}/follows?type=following`)}
              className="text-center md:text-left hover:opacity-80 transition-opacity active:scale-95"
            >
              <span className="block md:inline font-bold text-white text-sm lg:text-base">{followingCount}</span> 
              <span className="text-gold/40 md:text-gold/60 text-[9px] lg:text-sm uppercase md:lowercase md:ml-1 tracking-widest md:tracking-normal">seguidos</span>
            </button>
          </div>

          <div className="px-2 md:px-0">
            <h3 className="font-bold text-gold text-xs md:text-sm lg:text-base">{profile.displayName || profile.username}</h3>
            <p className="text-white/80 whitespace-pre-wrap mt-1 text-[11px] md:text-xs lg:text-sm leading-relaxed">{profile.bio || 'Sin biografía.'}</p>
          </div>
        </div>
      </header>

      <div className="border-t border-gold/10">
        <div className="flex justify-center space-x-12 lg:space-x-16 -mt-px">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex items-center space-x-2 py-3 lg:py-4 border-t-2 transition-all ${
              activeTab === 'posts' ? 'border-gold text-gold font-semibold' : 'border-transparent text-gold/40 hover:text-gold/60'
            }`}
          >
            <Grid size={16} className="lg:w-[18px] lg:h-[18px]" />
            <span className="uppercase tracking-wider text-[10px] lg:text-xs">Publicaciones</span>
          </button>
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('archive')}
              className={`flex items-center space-x-2 py-3 lg:py-4 border-t-2 transition-all ${
                activeTab === 'archive' ? 'border-gold text-gold font-semibold' : 'border-transparent text-gold/40 hover:text-gold/60'
              }`}
            >
              <Lock size={16} className="lg:w-[18px] lg:h-[18px]" />
              <span className="uppercase tracking-wider text-[10px] lg:text-xs">Archivo</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 mt-4">
          {canSeePosts ? (
            <>
              {(activeTab === 'posts' ? posts : archivedPosts).map((post) => (
                <motion.div 
                  key={post.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="aspect-square bg-black-soft overflow-hidden cursor-pointer relative group border border-gold/5"
                >
                  <img 
                    src={post.mediaUrl} 
                    alt={post.description} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-6 text-white font-bold">
                    <div className="flex items-center space-x-2"><Heart size={20} className="text-gold" fill="currentColor" /> <span>{post.likesCount || 0}</span></div>
                    <div className="flex items-center space-x-2"><MessageCircle size={20} className="text-gold" /> <span>{post.commentsCount || 0}</span></div>
                  </div>
                </motion.div>
              ))}
              {(activeTab === 'posts' ? posts : archivedPosts).length === 0 && (
                <div className="col-span-3 py-20 text-center">
                  <div className="w-16 h-16 bg-black-soft border border-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 text-gold/20">
                    {activeTab === 'posts' ? <Grid size={32} /> : <Lock size={32} />}
                  </div>
                  <p className="text-gold/40 font-medium">
                    {activeTab === 'posts' ? 'Aún no hay publicaciones' : 'No hay publicaciones archivadas'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="col-span-3 py-20 text-center">
              <div className="w-16 h-16 bg-black-soft border border-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 text-gold/20">
                <Lock size={32} />
              </div>
              <h3 className="text-white font-bold mb-1">Esta cuenta es privada</h3>
              <p className="text-gold/40 text-sm">Sigue a este usuario para ver sus fotos y vídeos.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showReportModal && (
          <ReportModal 
            onClose={() => setShowReportModal(false)}
            targetId={id!}
            targetType="user"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
