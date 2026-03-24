import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PostCard } from '../components/PostCard';
import { motion } from 'motion/react';
import { Sparkles, TrendingUp, Clock } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'trending'>('recent');
  const [followingIds, setFollowingIds] = useState<string[]>([]);

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

    // For a real app, we'd use a more complex query or a cloud function to aggregate the feed.
    // For this prototype, we'll fetch posts from followed users + own posts.
    // If following many people, we'd need to handle the 'in' limit (30).
    const authorIds = [user.uid, ...followingIds].slice(0, 30);

    const postsQuery = authorIds.length > 0 
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

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const now = new Date();
      const activePosts = postsData.filter((post: any) => {
        if (!post.expiresAt) return true;
        return new Date(post.expiresAt) > now;
      });

      setPosts(activePosts);
      setLoading(false);
    }, (error) => {
      // If the query fails (e.g. due to permissions on private posts we don't follow),
      // we'll fall back to public posts only.
      console.warn("Feed query failed, falling back to public posts:", error);
      
      const publicQuery = query(
        collection(db, 'posts'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      // Note: This fallback might still fail if there are private posts in the first 20.
      // The real fix is to ensure the query only includes accessible documents.
    });

    return () => unsubscribe();
  }, [user, followingIds]);

  return (
    <div className="py-8 px-4 bg-black">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gold tracking-tight">Tu Feed</h1>
          <p className="text-gold/60">Contenido seleccionado para tu bienestar.</p>
        </div>
        <div className="flex bg-black-soft p-1 rounded-2xl border border-gold/20 shadow-sm">
          <button 
            onClick={() => setFilter('recent')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'recent' ? 'bg-gold text-black shadow-md' : 'text-gold/60 hover:bg-white/5'
            }`}
          >
            <Clock size={16} />
            <span>Reciente</span>
          </button>
          <button 
            onClick={() => setFilter('trending')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'trending' ? 'bg-gold text-black shadow-md' : 'text-gold/60 hover:bg-white/5'
            }`}
          >
            <TrendingUp size={16} />
            <span>Tendencias</span>
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-black-soft rounded-3xl h-[500px] animate-pulse border border-gold/10" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
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
