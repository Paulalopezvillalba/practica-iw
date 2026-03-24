import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, getDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image, Smile, ArrowLeft, Info, MoreVertical, Phone, Video, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SharedPostPreview } from '../components/SharedPostPreview';

export const ChatWindow: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [chatData, setChatData] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;

    setUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const type = isVideo ? 'video' : 'image';
      
      const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const now = new Date().toISOString();
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: profile?.username || user.displayName,
        text: '',
        mediaUrl: url,
        mediaType: type,
        createdAt: now
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: isVideo ? '🎥 Vídeo' : '📷 Foto',
        lastMessageAt: now,
        [`lastReadAt.${user.uid}`]: now
      });
    } catch (error: any) {
      console.error("Error uploading file to chat:", error);
      if (error.code === 'storage/unauthorized' || error.code === 'storage/retry-limit-exceeded') {
        alert("Error de permisos en Storage. Asegúrate de que Firebase Storage esté activado.");
      } else {
        alert("Error al subir el archivo al chat.");
      }
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!chatId || !user) return;

    const chatRef = doc(db, 'chats', chatId);
    
    // Update lastReadAt when entering the chat or when messages update
    const updateLastRead = async () => {
      try {
        await updateDoc(chatRef, {
          [`lastReadAt.${user.uid}`]: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error updating lastReadAt:", error);
      }
    };

    updateLastRead();

    const unsubscribeChat = onSnapshot(chatRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChatData(data);

        if (data.type === 'individual') {
          const otherId = data.participants.find((p: string) => p !== user.uid);
          if (otherId) {
            const uDoc = await getDoc(doc(db, 'users', otherId));
            if (uDoc.exists()) {
              setOtherUser(uDoc.data());
            }
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
    });

    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
      
      // Update lastReadAt when new messages arrive while in the chat
      if (!snapshot.empty) {
        updateLastRead();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !user || !inputText.trim()) return;

    const text = inputText;
    setInputText('');

    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: profile?.username || user.displayName,
        text,
        createdAt: now
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastMessageAt: now,
        [`lastReadAt.${user.uid}`]: now
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-black text-gold">Cargando conversación...</div>;

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <header className="p-4 border-b border-gold/10 flex items-center justify-between bg-black/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/messages')} className="p-2 hover:bg-gold/10 rounded-full text-gold/60">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold font-bold border border-gold/20 overflow-hidden">
              {chatData?.type === 'individual' && otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                chatData?.name?.[0] || otherUser?.username?.[0] || 'C'
              )}
            </div>
            <div>
              <h3 className="font-bold text-white leading-tight">
                {chatData?.name || (otherUser ? `@${otherUser.username}` : 'Chat privado')}
              </h3>
              <p className="text-[10px] text-gold font-bold uppercase tracking-wider">En línea</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gold/40 hover:text-gold transition-colors"><Phone size={20} /></button>
          <button className="p-2 text-gold/40 hover:text-gold transition-colors"><Video size={20} /></button>
          <button className="p-2 text-gold/40 hover:text-gold transition-colors"><Info size={20} /></button>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-black"
      >
        {messages.map((msg, idx) => {
          const isOwn = msg.senderId === user?.uid;
          const showDate = idx === 0 || format(new Date(messages[idx-1].createdAt), 'yyyy-MM-dd') !== format(new Date(msg.createdAt), 'yyyy-MM-dd');

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="text-center my-8">
                  <span className="px-4 py-1 bg-black-soft rounded-full text-[10px] font-bold text-gold/40 uppercase tracking-widest border border-gold/10 shadow-sm">
                    {format(new Date(msg.createdAt), "d 'de' MMMM", { locale: es })}
                  </span>
                </div>
              )}
              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] group`}>
                  {!isOwn && chatData?.type === 'group' && (
                    <p className="text-[10px] font-bold text-gold/40 ml-4 mb-1 uppercase tracking-wider">
                      {msg.senderName}
                    </p>
                  )}
                  <div className={`
                    px-4 py-3 rounded-2xl text-sm shadow-xl space-y-2
                    ${isOwn 
                      ? 'bg-gold text-black rounded-tr-none font-medium' 
                      : 'bg-black-soft text-white rounded-tl-none border border-gold/10'}
                  `}>
                    {msg.sharedPostId && (
                      <div className="mb-2">
                        <SharedPostPreview postId={msg.sharedPostId} />
                      </div>
                    )}
                    {msg.mediaUrl && (
                      <div className="mb-2 rounded-xl overflow-hidden border border-white/10">
                        {msg.mediaType === 'video' ? (
                          <video src={msg.mediaUrl} controls className="max-w-full" />
                        ) : (
                          <img src={msg.mediaUrl} alt="Media" className="max-w-full h-auto object-cover" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    )}
                    {msg.text && <p>{msg.text}</p>}
                  </div>
                  <p className={`text-[9px] mt-1 font-medium text-gold/40 ${isOwn ? 'text-right mr-1' : 'text-left ml-1'}`}>
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Input */}
      <footer className="p-4 bg-black border-t border-gold/10">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <button type="button" className="p-2 text-gold/40 hover:text-gold transition-colors">
            <Smile size={24} />
          </button>
          <div className="flex-1 relative">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={uploading ? "Subiendo archivo..." : "Escribe un mensaje..."}
              disabled={uploading}
              className="w-full pl-4 pr-12 py-3 bg-black-soft rounded-2xl border border-gold/20 focus:ring-2 focus:ring-gold outline-none text-sm text-white placeholder:text-slate-600 disabled:opacity-50"
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/40 hover:text-gold transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <Image size={20} />}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              onChange={handleFileUpload} 
            />
          </div>
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 bg-gold text-black rounded-2xl hover:bg-gold-light transition-all shadow-lg shadow-gold/20 disabled:opacity-50 disabled:shadow-none"
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
};
