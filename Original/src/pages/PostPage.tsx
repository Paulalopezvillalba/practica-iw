import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PostCard } from '../components/PostCard';
import { motion } from 'motion/react';
import { ArrowLeft, Ban } from 'lucide-react';

export const PostPage: React.FC = () => {
  const { id } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'posts', id), (docSnap) => {
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
        setError(null);
      } else {
        setError('La publicación no está disponible.');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `posts/${id}`);
      setError('La publicación no está disponible.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-50 glass border-b border-gold/20 px-4 h-16 flex items-center space-x-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-gold/60 hover:text-gold transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">Publicación</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-8">
        {error ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 space-y-6"
          >
            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Ban size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white uppercase tracking-tighter">Contenido no disponible</h2>
              <p className="text-gold/40 font-medium">{error}</p>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="px-8 py-3 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all"
            >
              Volver atrás
            </button>
          </motion.div>
        ) : (
          post && <PostCard post={post} />
        )}
      </div>
    </div>
  );
};
