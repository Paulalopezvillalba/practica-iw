import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, getDoc, setDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, MoreHorizontal, Clock, Trash2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { analyzeComment } from '../services/geminiService';
import { SharePostModal } from './SharePostModal';

export const PostCard: React.FC<{ post: any }> = ({ post }) => {
  const { user, profile } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [moderationError, setModerationError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    const unsubscribeLike = onSnapshot(likeRef, (doc) => {
      setIsLiked(doc.exists());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `posts/${post.id}/likes/${user.uid}`);
    });

    const commentsQuery = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `posts/${post.id}/comments`);
    });

    return () => {
      unsubscribeLike();
      unsubscribeComments();
    };
  }, [post.id, user]);

  const handleLike = async () => {
    if (!user) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    const postRef = doc(db, 'posts', post.id);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        if ((post.likesCount || 0) > 0) {
          await updateDoc(postRef, { likesCount: increment(-1) });
        }
      } else {
        await setDoc(likeRef, { uid: user.uid, createdAt: new Date().toISOString() });
        await updateDoc(postRef, { likesCount: increment(1) });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;

    setModerationError('');
    const analysis = await analyzeComment(commentText);
    
    if (analysis.isOffensive) {
      setModerationError(`Comentario bloqueado: ${analysis.reason}`);
      return;
    }

    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        authorId: user.uid,
        authorName: profile?.username || user.displayName,
        text: commentText,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1)
      });

      setCommentText('');
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id, 'comments', commentId));
      if ((post.commentsCount || 0) > 0) {
        await updateDoc(doc(db, 'posts', post.id), {
          commentsCount: increment(-1)
        });
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black-soft rounded-2xl lg:rounded-3xl border border-gold/10 overflow-hidden mb-6 lg:mb-8 shadow-2xl"
    >
      {/* Header */}
      <div className="p-2.5 lg:p-4 flex items-center justify-between">
        <Link to={`/profile/${post.authorId}`} className="flex items-center space-x-2 lg:space-x-3 group">
          <img 
            src={post.authorPhoto} 
            alt={post.authorName} 
            className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-gold/20 group-hover:ring-2 group-hover:ring-gold transition-all"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
            }}
          />
          <div>
            <p className="font-bold text-xs lg:text-base text-white group-hover:text-gold transition-colors">@{post.authorName}</p>
            <p className="text-[9px] lg:text-xs text-gold/40 flex items-center space-x-1">
              <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: es })}</span>
              {post.duration !== 'permanent' && (
                <>
                  <span>•</span>
                  <Clock size={8} className="text-gold lg:w-2.5 lg:h-2.5" />
                  <span className="text-gold font-medium">Temporal</span>
                </>
              )}
            </p>
          </div>
        </Link>
        <button className="p-1.5 text-gold/40 hover:text-gold transition-colors">
          <MoreHorizontal size={16} className="lg:w-5 lg:h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="aspect-square bg-black relative">
        {post.mediaType === 'image' ? (
          <img 
            src={post.mediaUrl} 
            alt={post.description} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'https://via.placeholder.com/800x800?text=Imagen+no+disponible';
            }}
          />
        ) : (
          <video src={post.mediaUrl} className="w-full h-full object-cover" controls />
        )}
      </div>

      {/* Actions */}
      <div className="p-2.5 lg:p-4">
        <div className="flex items-center justify-between mb-2.5 lg:mb-4">
          <div className="flex items-center space-x-4 lg:space-x-6">
            <button 
              onClick={handleLike}
              className={`transition-all hover:scale-110 ${isLiked ? 'text-red-500' : 'text-gold/60 hover:text-red-500'}`}
            >
              <Heart size={22} className="lg:w-7 lg:h-7" fill={isLiked ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className="text-gold/60 hover:text-gold transition-all hover:scale-110"
            >
              <MessageCircle size={22} className="lg:w-7 lg:h-7" strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => setShowShareModal(true)}
              className="text-gold/60 hover:text-gold transition-all hover:scale-110"
            >
              <Send size={22} className="lg:w-7 lg:h-7" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="space-y-1 lg:space-y-2">
          <p className="font-bold text-xs lg:text-base text-white">{Math.max(0, post.likesCount || 0)} Me gusta</p>
          <div className="text-[13px] lg:text-sm text-gold/80 leading-snug">
            <span className="font-bold mr-1.5 text-white">@{post.authorName}</span>
            {post.description}
          </div>
          {post.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {post.hashtags.map((tag: string) => (
                <span key={tag} className="text-gold text-[11px] lg:text-xs font-medium hover:underline cursor-pointer">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {Math.max(0, post.commentsCount || 0) > 0 && !showComments && (
            <button 
              onClick={() => setShowComments(true)}
              className="text-gold/40 text-[11px] lg:text-sm font-medium hover:text-gold mt-1"
            >
              Ver los {Math.max(0, post.commentsCount || 0)} comentarios
            </button>
          )}
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-gold/10 space-y-3 overflow-hidden"
            >
              <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start justify-between space-x-2 group/comment">
                    <div className="flex-1">
                      <p className="text-[12px] lg:text-sm text-gold/80 leading-tight">
                        <span className="font-bold mr-1.5 text-white">@{comment.authorName}</span>
                        {comment.text}
                      </p>
                      <p className="text-[9px] text-gold/40 mt-0.5">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                    {user?.uid === comment.authorId && (
                      <button 
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-gold/20 hover:text-red-500 transition-colors p-1 opacity-0 group-hover/comment:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="relative mt-3">
                <input 
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Añade un comentario..."
                  className="w-full px-3 py-2 bg-black rounded-xl border border-gold/20 text-white focus:ring-1 focus:ring-gold outline-none pr-12 text-[12px] placeholder:text-slate-600"
                />
                <button 
                  type="submit"
                  disabled={!commentText.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-[12px] font-bold disabled:opacity-30"
                >
                  Publicar
                </button>
              </form>
              {moderationError && (
                <p className="text-xs text-red-400 font-medium mt-2">{moderationError}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showShareModal && (
          <SharePostModal 
            post={post} 
            onClose={() => setShowShareModal(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
