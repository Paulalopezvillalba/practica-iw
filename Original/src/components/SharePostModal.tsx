import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Send, Users, CheckCircle2 } from 'lucide-react';

interface SharePostModalProps {
  post: any;
  onClose: () => void;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({ post, onClose }) => {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentChats, setSentChats] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleShare = async (chatId: string) => {
    if (!user || sentChats.includes(chatId)) return;

    setSendingTo(chatId);
    try {
      const messageText = `Compartió una publicación de @${post.authorName}`;
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: profile?.username || user.displayName,
        text: messageText,
        sharedPostId: post.id,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: messageText,
        lastMessageAt: new Date().toISOString()
      });

      setSentChats(prev => [...prev, chatId]);
    } catch (error) {
      console.error("Error sharing post:", error);
    } finally {
      setSendingTo(null);
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.type === 'individual'
  );

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-black-soft w-full max-w-md rounded-3xl border border-gold/20 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] relative z-10"
      >
        <div className="p-4 border-b border-gold/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Compartir publicación</h2>
          <button onClick={onClose} className="p-2 text-gold/40 hover:text-gold transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/40" size={18} />
            <input 
              type="text"
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-black rounded-2xl border border-gold/10 focus:ring-2 focus:ring-gold outline-none text-sm text-white placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-gold/40 italic">Cargando chats...</div>
          ) : filteredChats.length > 0 ? (
            filteredChats.map(chat => (
              <div 
                key={chat.id}
                className="flex items-center justify-between p-3 hover:bg-gold/5 rounded-2xl transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-black rounded-xl border border-gold/10 flex items-center justify-center text-gold/40 overflow-hidden">
                    {chat.type === 'group' ? <Users size={24} /> : (
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                        alt="Chat" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {chat.name || (chat.type === 'individual' ? 'Chat privado' : 'Grupo')}
                    </h3>
                    <p className="text-[10px] text-gold/40 uppercase tracking-widest font-bold">
                      {chat.type === 'group' ? 'Grupo' : 'Privado'}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleShare(chat.id)}
                  disabled={sentChats.includes(chat.id) || sendingTo === chat.id}
                  className={`
                    px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2
                    ${sentChats.includes(chat.id) 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'bg-gold text-black hover:bg-gold-light shadow-lg shadow-gold/10'}
                    disabled:opacity-50
                  `}
                >
                  {sendingTo === chat.id ? (
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : sentChats.includes(chat.id) ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Enviado</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Enviar</span>
                    </>
                  )}
                </button>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gold/40 italic">
              No se encontraron chats
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gold/10 bg-black/20">
          <div className="flex items-center space-x-3">
            <img 
              src={post.mediaUrl} 
              alt="Post preview" 
              className="w-12 h-12 rounded-xl object-cover border border-gold/20"
            />
            <div>
              <p className="text-xs font-bold text-white">Compartiendo publicación</p>
              <p className="text-[10px] text-gold/60">de @{post.authorName}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};
