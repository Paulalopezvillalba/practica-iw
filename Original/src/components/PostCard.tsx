import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, getDoc, setDoc, deleteDoc, increment, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, MoreHorizontal, Clock, Trash2, Send, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { analyzeComment } from '../services/geminiService';
import { SharePostModal } from './SharePostModal';
import { ReportModal } from './ReportModal';

export const PostCard: React.FC<{ post: any; onHashtagClick?: (tag: string) => void }> = ({ post, onHashtagClick }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [moderationError, setModerationError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string, type: 'post' | 'comment' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

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
        
        // Create notification for post author
        if (post.authorId !== user.uid) {
          await addDoc(collection(db, 'users', post.authorId, 'notifications'), {
            type: 'like',
            fromUserId: user.uid,
            fromUserName: profile?.username || user.displayName,
            fromUserPhoto: profile?.photoURL || user.photoURL,
            postId: post.id,
            text: 'le ha dado a me gusta a tu foto',
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      if (!isLiked) {
        handleLike();
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
    }
    setLastTap(now);
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
      const commentRef = await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        authorId: user.uid,
        authorName: profile?.username || user.displayName,
        text: commentText,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1)
      });

      // Create notification for post author
      if (post.authorId !== user.uid) {
        await addDoc(collection(db, 'users', post.authorId, 'notifications'), {
          type: 'comment',
          fromUserId: user.uid,
          fromUserName: profile?.username || user.displayName,
          fromUserPhoto: profile?.photoURL || user.photoURL,
          postId: post.id,
          text: `comentó: "${commentText.substring(0, 30)}${commentText.length > 30 ? '...' : ''}"`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }

      // Handle mentions
      // Support accented characters and common symbols in usernames
      const mentionMatches = commentText.match(/@([a-zA-Z0-9_À-ÿ.]+)/g);
      if (mentionMatches) {
        const potentialUsernames = Array.from(new Set(mentionMatches.map(m => m.substring(1).toLowerCase())));
        
        for (const rawUsername of potentialUsernames) {
          let username = rawUsername;
          let foundUser = null;
          let foundUserId = null;

          // Greedy search: try the whole string, then strip characters from the end one by one
          // This handles cases like "@paula_lópez_villalba." or "@user!"
          while (username.length > 0) {
            const userQuery = query(collection(db, 'users'), where('username', '==', username));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              foundUser = userSnapshot.docs[0].data();
              foundUserId = foundUser.uid;
              break;
            }
            // Strip last character and try again (handles trailing punctuation)
            username = username.slice(0, -1);
          }

          if (foundUserId) {
            try {
              // Add to permittedUsers (always do this if found)
              await updateDoc(doc(db, 'posts', post.id), {
                permittedUsers: arrayUnion(foundUserId)
              });

              // Create notification (even for self for testing, or just to be sure)
              await addDoc(collection(db, 'users', foundUserId, 'notifications'), {
                type: 'mention',
                fromUserId: user.uid,
                fromUserName: profile?.username || user.displayName || 'usuario',
                fromUserPhoto: profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=random`,
                postId: post.id,
                text: 'te ha mencionado en un comentario',
                isRead: false,
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.error("Error processing mention for", username, err);
            }
          }
        }
      }

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
      handleFirestoreError(error, OperationType.DELETE, `posts/${post.id}/comments/${commentId}`);
    }
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDeletePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    if (user.uid !== post.authorId) return;
    
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowConfirmDelete(false), 3000);
      return;
    }
    
    setIsDeleting(true);
    try {
      console.log("Attempting to delete post:", post.id);
      await deleteDoc(doc(db, 'posts', post.id));
      console.log("Post deleted successfully");
    } catch (error) {
      console.error("Error deleting post:", error);
      handleFirestoreError(error, OperationType.DELETE, `posts/${post.id}`);
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black-soft rounded-2xl lg:rounded-3xl border border-gold/10 overflow-hidden mb-6 lg:mb-8 shadow-2xl"
      >
        {/* Header */}
        <div className="p-3 lg:p-4 flex items-center justify-between">
          <Link to={`/profile/${post.authorId}`} className="flex items-center space-x-3 lg:space-x-4 group">
            <img 
              src={post.authorPhoto} 
              alt={post.authorName} 
              className="w-9 h-9 lg:w-11 lg:h-11 rounded-full border border-gold/20 group-hover:ring-2 group-hover:ring-gold transition-all object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${post.authorName}&background=random`;
              }}
            />
            <div>
              <p className="font-bold text-sm lg:text-base text-white group-hover:text-gold transition-colors">@{post.authorName}</p>
              <p className="text-[10px] lg:text-xs text-gold/40 flex items-center space-x-1">
                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: es })}</span>
                {post.duration !== 'permanent' && (
                  <>
                    <span>•</span>
                    <Clock size={10} className="text-gold lg:w-3 lg:h-3" />
                    <span className="text-gold font-medium">Temporal</span>
                  </>
                )}
              </p>
            </div>
          </Link>
          <div className="flex items-center space-x-2">
            {user?.uid === post.authorId && (
              <button 
                onClick={handleDeletePost}
                disabled={isDeleting}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all ${
                  showConfirmDelete 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-gold/40 hover:text-red-500 hover:bg-red-500/10'
                } disabled:opacity-50`}
                title={showConfirmDelete ? "Pulsa de nuevo para confirmar" : "Eliminar publicación"}
              >
                <Trash2 size={18} className="lg:w-5 lg:h-5" />
                {showConfirmDelete && <span className="text-[10px] font-bold uppercase">Confirmar</span>}
              </button>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowOptions(!showOptions)}
                className="p-2 text-gold/40 hover:text-gold transition-colors active:scale-90"
              >
                <MoreHorizontal size={20} className="lg:w-6 lg:h-6" />
              </button>
              
              {/* Desktop Dropdown */}
              <AnimatePresence>
                {showOptions && (
                  <div className="hidden lg:block">
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowOptions(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-black-soft border border-gold/20 rounded-xl shadow-2xl z-20 overflow-hidden"
                    >
                      {user?.uid !== post.authorId && (
                        <button
                          onClick={() => {
                            setReportTarget({ id: post.id, type: 'post' });
                            setShowReportModal(true);
                            setShowOptions(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gold hover:bg-gold/10 flex items-center space-x-2 transition-colors"
                        >
                          <Flag size={14} />
                          <span>Reportar publicación</span>
                        </button>
                      )}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="aspect-square bg-black relative overflow-hidden" onClick={handleDoubleTap}>
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

          <AnimatePresence>
            {showHeartAnimation && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              >
                <Heart size={120} fill="white" className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="p-3 lg:p-4">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center space-x-5 lg:space-x-6">
              <button 
                onClick={handleLike}
                className={`transition-all hover:scale-110 ${isLiked ? 'text-red-500' : 'text-gold/60 hover:text-red-500'}`}
              >
                <Heart size={24} className="lg:w-7 lg:h-7" fill={isLiked ? 'currentColor' : 'none'} strokeWidth={1.5} />
              </button>
              <button 
                onClick={() => setShowComments(!showComments)}
                className="text-gold/60 hover:text-gold transition-all hover:scale-110"
              >
                <MessageCircle size={24} className="lg:w-7 lg:h-7" strokeWidth={1.5} />
              </button>
              <button 
                onClick={() => setShowShareModal(true)}
                className="text-gold/60 hover:text-gold transition-all hover:scale-110"
              >
                <Send size={24} className="lg:w-7 lg:h-7" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 lg:space-y-2">
            <p className="font-bold text-sm lg:text-base text-white">{Math.max(0, post.likesCount || 0)} Me gusta</p>
            <div className="text-[14px] lg:text-sm text-gold/80 leading-relaxed">
              <span className="font-bold mr-2 text-white">@{post.authorName}</span>
              {post.description}
            </div>
            {post.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {post.hashtags.map((tag: string) => (
                  <button 
                    key={tag} 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
                      if (onHashtagClick) {
                        onHashtagClick(cleanTag);
                      } else {
                        navigate(`/?tag=${encodeURIComponent(cleanTag)}`);
                      }
                    }}
                    className="text-gold text-[12px] lg:text-xs font-bold hover:underline cursor-pointer active:scale-95 transition-transform"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </button>
                ))}
              </div>
            )}
            {Math.max(0, post.commentsCount || 0) > 0 && !showComments && (
              <button 
                onClick={() => setShowComments(true)}
                className="text-gold/40 text-[12px] lg:text-sm font-medium hover:text-gold mt-1"
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
                <div className="max-h-[250px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start justify-between space-x-3 group/comment">
                      <div className="flex-1">
                        <p className="text-[13px] lg:text-sm text-gold/80 leading-tight">
                          <span className="font-bold mr-2 text-white">@{comment.authorName}</span>
                          {comment.text}
                        </p>
                        <p className="text-[10px] text-gold/40 mt-1">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                        <div className="flex items-center space-x-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                          {user?.uid !== comment.authorId && (
                            <button 
                              onClick={() => {
                                setReportTarget({ id: comment.id, type: 'comment' });
                                setShowReportModal(true);
                              }}
                              className="text-gold/20 hover:text-gold transition-colors p-1.5"
                              title="Reportar comentario"
                            >
                              <Flag size={14} />
                            </button>
                          )}
                          {user?.uid === comment.authorId && (
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-gold/20 hover:text-red-500 transition-colors p-1.5"
                              title="Eliminar comentario"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="relative mt-4">
                  <input 
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Añade un comentario..."
                    className="w-full px-4 py-2.5 bg-black rounded-xl border border-gold/20 text-white focus:ring-1 focus:ring-gold outline-none pr-16 text-[13px] placeholder:text-slate-600"
                  />
                  <button 
                    type="submit"
                    disabled={!commentText.trim()}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gold text-[13px] font-bold disabled:opacity-30"
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
      </motion.div>

      {/* Portals for Modals to avoid stacking context issues */}
      {createPortal(
        <AnimatePresence>
          {showOptions && (
            <div className="lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                onClick={() => setShowOptions(false)}
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-[101] bg-black-soft border-t border-gold/20 rounded-t-[32px] p-6 pb-safe shadow-2xl"
              >
                <div className="w-12 h-1.5 bg-gold/20 rounded-full mx-auto mb-6" />
                <div className="space-y-3">
                  {user?.uid === post.authorId ? (
                    <button 
                      onClick={(e) => {
                        handleDeletePost(e);
                        setShowOptions(false);
                      }}
                      disabled={isDeleting}
                      className="w-full flex items-center space-x-4 p-4 text-rose-500 bg-rose-500/5 rounded-2xl transition-colors text-base font-bold active:scale-95"
                    >
                      <Trash2 size={22} />
                      <span>{isDeleting ? 'Eliminando...' : 'Eliminar publicación'}</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setReportTarget({ id: post.id, type: 'post' });
                        setShowReportModal(true);
                        setShowOptions(false);
                      }}
                      className="w-full flex items-center space-x-4 p-4 text-gold bg-gold/5 rounded-2xl transition-colors text-base font-bold active:scale-95"
                    >
                      <Flag size={22} />
                      <span>Reportar publicación</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowOptions(false)}
                    className="w-full p-4 text-gold/60 font-bold text-base active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {showShareModal && (
          <SharePostModal 
            post={post} 
            onClose={() => setShowShareModal(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReportModal && reportTarget && (
          <ReportModal 
            targetId={reportTarget.id}
            targetType={reportTarget.type}
            onClose={() => {
              setShowReportModal(false);
              setReportTarget(null);
            }} 
          />
        )}
      </AnimatePresence>
    </>
  );
};
