import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { Play, Image as ImageIcon } from 'lucide-react';

export const SharedPostPreview: React.FC<{ postId: string }> = ({ postId }) => {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
          setPost({ id: postDoc.id, ...postDoc.data() });
        }
      } catch (error) {
        console.error("Error fetching shared post:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  if (loading) return <div className="w-48 h-24 bg-black/20 animate-pulse rounded-xl border border-gold/10" />;
  if (!post) return <div className="text-[10px] text-gold/40 italic">Publicación no disponible</div>;

  return (
    <Link 
      to={`/profile/${post.authorId}`}
      className="block w-48 lg:w-64 bg-black rounded-xl border border-gold/20 overflow-hidden hover:border-gold/40 transition-all shadow-lg"
    >
      <div className="relative aspect-square">
        <img 
          src={post.mediaUrl} 
          alt={post.description} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 flex items-center space-x-2">
          <img 
            src={post.authorPhoto} 
            alt={post.authorName} 
            className="w-5 h-5 rounded-full border border-gold/20"
            referrerPolicy="no-referrer"
          />
          <span className="text-[10px] font-bold text-white truncate">@{post.authorName}</span>
        </div>
        {post.mediaType === 'video' && (
          <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-full">
            <Play size={10} className="text-white fill-white" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[10px] text-gold/80 line-clamp-2 leading-tight">
          {post.description}
        </p>
      </div>
    </Link>
  );
};
