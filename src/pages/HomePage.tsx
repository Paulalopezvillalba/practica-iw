import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PostCard } from '../components/PostCard';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, TrendingUp, Clock, Coffee, X, Hash } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedHashtag = searchParams.get('tag');
  
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'trending'>('recent');
  const [showHashtagInput, setShowHashtagInput] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [showPause, setShowPause] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [showScrollBreak, setShowScrollBreak] = useState(false);
  const sessionStartRef = useRef<number>(Date.now());
  const lastScrollY = useRef<number>(0);
  const totalScrollDistance = useRef<number>(0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // The onSnapshot will automatically update, but we simulate a delay for UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!profile?.feedPausesEnabled) return;

    const checkPause = () => {
      const elapsed = Date.now() - sessionStartRef.current;
      const minutes = elapsed / 60000;
      
      // Show pause every 15 minutes
      if (minutes >= 15 && !showPause) {
        setShowPause(true);
      }
    };

    const interval = setInterval(checkPause, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [profile?.feedPausesEnabled, showPause]);

  const handleDismissPause = () => {
    setShowPause(false);
    sessionStartRef.current = Date.now(); // Reset session
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = Math.abs(currentScrollY - lastScrollY.current);
      totalScrollDistance.current += delta;
      lastScrollY.current = currentScrollY;

      // Trigger break after scrolling roughly 10,000 pixels (about 15-20 posts)
      if (totalScrollDistance.current > 10000 && !showScrollBreak) {
        setShowScrollBreak(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showScrollBreak]);

  const handleDismissScrollBreak = () => {
    setShowScrollBreak(false);
    totalScrollDistance.current = 0; // Reset scroll distance
  };

  useEffect(() => {
    if (!user) return;

    const unsubscribeFollowing = onSnapshot(collection(db, 'users', user.uid, 'following'), (snapshot) => {
      setFollowingIds(snapshot.docs.map(doc => doc.id));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/following`);
    });

    return () => unsubscribeFollowing();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    let postsQuery;

    if (selectedHashtag) {
      // Filter by hashtag - Chronological order
      postsQuery = query(
        collection(db, 'posts'),
        where('hashtags', 'array-contains', selectedHashtag),
        where('status', '==', 'active'),
        limit(30)
      );
    } else {
      // Normal feed (following + own)
      const authorIds = [user.uid, ...followingIds].slice(0, 30);
      postsQuery = authorIds.length > 0 
        ? query(
            collection(db, 'posts'),
            where('authorId', 'in', authorIds),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc'),
            limit(30)
          )
        : query(
            collection(db, 'posts'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc'),
            limit(30)
          );
    }

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      let postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory if filtering by hashtag (to avoid index requirement)
      // This ensures chronological order as requested
      if (selectedHashtag) {
        postsData.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      }

      const now = new Date();
      const activePosts = postsData.filter((post: any) => {
        if (!post.expiresAt) return true;
        return new Date(post.expiresAt) > now;
      });

      setPosts(activePosts);
      setLoading(false);
    }, (error) => {
      console.warn("Feed query failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, followingIds, selectedHashtag]);

  return (
    <div className="pt-safe pb-8 px-4 bg-black">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gold tracking-tight flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              {selectedHashtag ? (
                <>
                  <Hash className="text-gold" size={28} />
                  <span>{selectedHashtag.startsWith('#') ? selectedHashtag.slice(1) : selectedHashtag}</span>
                </>
              ) : (
                <span>Tu Feed</span>
              )}
            </div>
            <motion.button 
              onClick={handleRefresh}
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ repeat: isRefreshing ? Infinity : 0, duration: 1, ease: "linear" }}
              className="lg:hidden p-2 text-gold/60 hover:text-gold active:scale-90"
            >
              <Sparkles size={24} />
            </motion.button>
          </h1>
          <p className="text-gold/60">
            {selectedHashtag 
              ? `Mostrando publicaciones cronológicas con ${selectedHashtag}` 
              : 'Contenido seleccionado para tu bienestar.'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedHashtag && (
            <button 
              onClick={() => setSearchParams({})}
              className="text-gold/60 hover:text-gold text-xs font-bold flex items-center space-x-1 bg-gold/5 px-4 py-2 rounded-xl border border-gold/20 transition-all hover:bg-gold/10"
            >
              <X size={14} />
              <span>Limpiar filtro</span>
            </button>
          )}
          <div className="flex bg-black-soft p-1 rounded-2xl border border-gold/20 shadow-sm relative">
            <button 
              onClick={() => {
                setFilter('recent');
                setShowHashtagInput(false);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === 'recent' && !showHashtagInput ? 'bg-gold text-black shadow-md' : 'text-gold/60 hover:bg-white/5'
              }`}
            >
              <Clock size={16} />
              <span className="hidden sm:inline">Reciente</span>
            </button>
            <button 
              onClick={() => {
                setFilter('trending');
                setShowHashtagInput(false);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === 'trending' && !showHashtagInput ? 'bg-gold text-black shadow-md' : 'text-gold/60 hover:bg-white/5'
              }`}
            >
              <TrendingUp size={16} />
              <span className="hidden sm:inline">Tendencias</span>
            </button>
            <button 
              onClick={() => setShowHashtagInput(!showHashtagInput)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                showHashtagInput ? 'bg-gold text-black shadow-md' : 'text-gold/60 hover:bg-white/5'
              }`}
            >
              <Hash size={16} />
              <span>Filtrar #</span>
            </button>

            <AnimatePresence>
              {showHashtagInput && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 z-50 bg-black-soft border border-gold/20 p-3 rounded-2xl shadow-2xl min-w-[240px]"
                >
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (hashtagInput.trim()) {
                        const tag = hashtagInput.trim().startsWith('#') ? hashtagInput.trim() : `#${hashtagInput.trim()}`;
                        setSearchParams({ tag });
                        setShowHashtagInput(false);
                        setHashtagInput('');
                      }
                    }}
                    className="flex items-center space-x-2"
                  >
                    <div className="relative flex-1">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/40" size={14} />
                      <input 
                        type="text"
                        value={hashtagInput}
                        onChange={(e) => setHashtagInput(e.target.value)}
                        placeholder="Escribe un hashtag..."
                        autoFocus
                        className="w-full pl-8 pr-3 py-2 bg-black border border-gold/20 rounded-xl text-white text-sm focus:ring-1 focus:ring-gold outline-none placeholder:text-slate-600"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="p-2 bg-gold text-black rounded-xl hover:bg-gold-light transition-colors"
                    >
                      <Sparkles size={16} />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto relative">
        <AnimatePresence>
          {showScrollBreak && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="sticky top-20 z-40 mb-8 p-6 bg-black-soft text-gold rounded-3xl shadow-2xl flex items-center justify-between border-2 border-gold/30 backdrop-blur-xl"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight">¡Vaya scroll!</h3>
                  <p className="text-gold/60 text-sm font-bold">Has recorrido mucha distancia. Tus ojos merecen un descanso.</p>
                </div>
              </div>
              <button 
                onClick={handleDismissScrollBreak}
                className="p-2 hover:bg-gold/10 rounded-full transition-colors text-gold"
              >
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPause && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="sticky top-20 z-40 mb-8 p-6 bg-gold text-black rounded-3xl shadow-2xl flex items-center justify-between border-4 border-black"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                  <Coffee size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight">Tómate un respiro</h3>
                  <p className="text-black/60 text-sm font-bold">Llevas un rato navegando. ¿Qué tal un descanso?</p>
                </div>
              </div>
              <button 
                onClick={handleDismissPause}
                className="p-2 hover:bg-black/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-black-soft rounded-3xl h-[500px] animate-pulse border border-gold/10" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onHashtagClick={(tag) => setSearchParams({ tag })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-black-soft rounded-3xl border border-dashed border-gold/20">
            <Sparkles size={48} className="mx-auto text-gold/20 mb-4" />
            <h3 className="text-xl font-bold text-gold mb-2">¡Bienvenido a Original!</h3>
            <p className="text-gold/60 max-w-xs mx-auto">
              Aún no hay publicaciones. Sé el primero en compartir algo auténtico.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
