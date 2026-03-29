import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, getDoc, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image, Smile, ArrowLeft, Info, MoreVertical, Phone, Video, Loader2, Users, UserPlus, UserMinus, VolumeX, Volume2, Trash2, BarChart2, Check, Plus, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SharedPostPreview } from '../components/SharedPostPreview';
import { ReportModal } from '../components/ReportModal';

interface PollOption {
  text: string;
  votes: string[];
}

interface PollData {
  question: string;
  options: PollOption[];
}

export const ChatWindow: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [chatData, setChatData] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
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
        } else if (data.type === 'group') {
          // Fetch group members details
          const memberDetails = await Promise.all(
            data.participants.map(async (id: string) => {
              const uDoc = await getDoc(doc(db, 'users', id));
              return uDoc.exists() ? { uid: id, ...uDoc.data() } : { uid: id, username: 'Usuario' };
            })
          );
          setGroupMembers(memberDetails);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
    });

    // Fetch Following for adding members
    const fetchFollowing = async () => {
      const followingRef = collection(db, 'users', user.uid, 'following');
      const unsubscribeFollowing = onSnapshot(followingRef, async (snap) => {
        const followingIds = snap.docs.map(doc => doc.id);
        const detailedUsers = await Promise.all(
          followingIds.map(async (id) => {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              const data = userDoc.data();
              return {
                uid: id,
                username: data.username || 'Usuario',
                displayName: data.displayName || '',
                photoURL: data.photoURL || ''
              };
            }
            return null;
          })
        );
        setFollowingList(detailedUsers.filter(u => u !== null));
      });
      return unsubscribeFollowing;
    };

    let unsubFollowing: () => void;
    fetchFollowing().then(unsub => unsubFollowing = unsub);

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
      if (unsubFollowing) unsubFollowing();
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

    // Check if muted
    if (chatData?.mutedParticipants?.includes(user.uid)) {
      alert("Estás silenciado en este grupo.");
      return;
    }

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

  const handleCreatePoll = async () => {
    if (!chatId || !user || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;

    try {
      const now = new Date().toISOString();
      const pollData: PollData = {
        question: pollQuestion.trim(),
        options: pollOptions
          .filter(o => o.trim())
          .map(text => ({ text: text.trim(), votes: [] }))
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: profile?.username || user.displayName,
        mediaType: 'poll',
        pollData,
        createdAt: now
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: `📊 Encuesta: ${pollQuestion}`,
        lastMessageAt: now,
        [`lastReadAt.${user.uid}`]: now
      });

      setShowCreatePoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch (error) {
      console.error("Error creating poll:", error);
    }
  };

  const handleVote = async (messageId: string, optionIndex: number) => {
    if (!chatId || !user) return;

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.pollData) return;

    const newPollData = { ...message.pollData };
    
    // Remove previous vote if any
    newPollData.options = newPollData.options.map((opt: any) => ({
      ...opt,
      votes: opt.votes.filter((v: string) => v !== user.uid)
    }));

    // Add new vote
    newPollData.options[optionIndex].votes.push(user.uid);

    try {
      await updateDoc(messageRef, { pollData: newPollData });
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!chatId || !user) return;

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = message.reactions || {};
    const currentEmojiReactions = reactions[emoji] || [];

    let newReactions = { ...reactions };
    if (currentEmojiReactions.includes(user.uid)) {
      // Remove reaction
      newReactions[emoji] = currentEmojiReactions.filter((id: string) => id !== user.uid);
      if (newReactions[emoji].length === 0) {
        delete newReactions[emoji];
      }
    } else {
      // Add reaction
      newReactions[emoji] = [...currentEmojiReactions, user.uid];
    }

    try {
      await updateDoc(messageRef, { reactions: newReactions });
      setReactingToMessageId(null);
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!chatId || !user) return;
    
    const isModerator = chatData?.moderatorId === user.uid;
    const message = messages.find(m => m.id === messageId);
    const isOwner = message?.senderId === user.uid;

    if (!isModerator && !isOwner) return;

    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}/messages/${messageId}`);
    }
  };

  const handleAddMember = async (targetUid: string) => {
    if (!chatId || !chatData || chatData.moderatorId !== user?.uid) return;

    try {
      const newParticipants = [...chatData.participants, targetUid];
      await updateDoc(doc(db, 'chats', chatId), {
        participants: newParticipants
      });
      setShowAddMember(false);
    } catch (error) {
      console.error("Error adding member:", error);
    }
  };

  const handleRemoveMember = async (targetUid: string) => {
    if (!chatId || !chatData || chatData.moderatorId !== user?.uid) return;
    if (targetUid === user?.uid) return; // Cannot remove self

    try {
      const newParticipants = chatData.participants.filter((id: string) => id !== targetUid);
      await updateDoc(doc(db, 'chats', chatId), {
        participants: newParticipants
      });
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  const handleToggleMute = async (targetUid: string) => {
    if (!chatId || !chatData || chatData.moderatorId !== user?.uid) return;

    try {
      const isMuted = chatData.mutedParticipants?.includes(targetUid);
      let newMuted = chatData.mutedParticipants || [];
      
      if (isMuted) {
        newMuted = newMuted.filter((id: string) => id !== targetUid);
      } else {
        newMuted = [...newMuted, targetUid];
      }

      await updateDoc(doc(db, 'chats', chatId), {
        mutedParticipants: newMuted
      });
    } catch (error) {
      console.error("Error toggling mute:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!chatId || !chatData) return;
    
    if (chatData.moderatorId !== user?.uid) return;
    
    if (!window.confirm("¿Estás seguro de que quieres eliminar este grupo? Esta acción no se puede deshacer.")) return;
    
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      navigate('/messages');
    } catch (error) {
      console.error("Error deleting group:", error);
      handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}`);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-black text-gold">Cargando conversación...</div>;

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <header className="pt-safe border-b border-gold/10 bg-black/80 backdrop-blur-md sticky top-0 z-10">
        <div className="p-3 lg:p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 lg:space-x-4">
            <button onClick={() => navigate('/messages')} className="p-2 hover:bg-gold/10 rounded-full text-gold/60 active:scale-90">
              <ArrowLeft size={20} className="lg:w-6 lg:h-6" />
            </button>
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gold/10 rounded-lg lg:rounded-xl flex items-center justify-center text-gold font-bold border border-gold/20 overflow-hidden">
                {chatData?.type === 'individual' && otherUser?.photoURL ? (
                  <img src={otherUser.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  chatData?.name?.[0] || otherUser?.username?.[0] || 'C'
                )}
              </div>
              <div>
                <h3 className="font-bold text-white leading-tight text-sm lg:text-base truncate max-w-[120px] md:max-w-none">
                  {chatData?.name || (otherUser ? `@${otherUser.username}` : 'Chat privado')}
                </h3>
                <p className="text-[8px] lg:text-[10px] text-gold font-bold uppercase tracking-wider">En línea</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 lg:space-x-2">
            <button className="p-2 text-gold/40 hover:text-gold transition-colors active:scale-90"><Phone size={18} className="lg:w-5 lg:h-5" /></button>
            <button className="p-2 text-gold/40 hover:text-gold transition-colors active:scale-90"><Video size={18} className="lg:w-5 lg:h-5" /></button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-gold/40 hover:text-gold transition-colors active:scale-90"
            >
              <Info size={18} className="lg:w-5 lg:h-5" />
            </button>
          </div>
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
                    {msg.mediaType === 'poll' && msg.pollData && (
                      <div className="space-y-3 p-1">
                        <h4 className="font-bold text-sm mb-2">{msg.pollData.question}</h4>
                        <div className="space-y-2">
                          {msg.pollData.options.map((opt: any, optIdx: number) => {
                            const totalVotes = msg.pollData.options.reduce((acc: number, curr: any) => acc + (curr.votes?.length || 0), 0);
                            const percentage = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
                            const hasVoted = opt.votes?.includes(user?.uid);

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleVote(msg.id, optIdx)}
                                className={`w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                                  hasVoted ? 'border-gold bg-gold/10' : 'border-white/10 hover:border-gold/30'
                                }`}
                              >
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-gold/20 transition-all duration-500" 
                                  style={{ width: `${percentage}%` }}
                                />
                                <div className="relative flex justify-between items-center text-xs">
                                  <span className="font-medium">{opt.text}</span>
                                  <span className="font-bold opacity-60">{percentage}%</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-gold/40 text-center mt-2 uppercase tracking-widest font-bold">
                          {msg.pollData.options.reduce((acc: number, curr: any) => acc + (curr.votes?.length || 0), 0)} votos totales
                        </p>
                      </div>
                    )}
                    {msg.text && <p>{msg.text}</p>}
                    
                    {/* Reactions Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(msg.reactions).map(([emoji, uids]: [string, any]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all ${
                              uids.includes(user?.uid)
                                ? 'bg-gold/20 border-gold text-gold'
                                : 'bg-black/20 border-white/10 text-white/60 hover:border-white/30'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-bold">{uids.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1 px-1">
                    <p className={`text-[9px] font-medium text-gold/40`}>
                      {format(new Date(msg.createdAt), 'HH:mm')}
                    </p>
                    
                    <div className="flex items-center space-x-2">
                      {/* Report Button (for non-owners) */}
                      {!isOwn && (
                        <button 
                          onClick={() => {
                            setReportTargetId(msg.id);
                            setShowReportModal(true);
                          }}
                          className="p-1 text-gold/20 hover:text-gold/60 transition-colors"
                          title="Reportar mensaje"
                        >
                          <Flag size={12} />
                        </button>
                      )}

                      {/* Delete Button (for owner or moderator) */}
                      {(isOwn || chatData?.moderatorId === user?.uid) && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1 text-rose-500/20 hover:text-rose-500/60 transition-colors"
                          title="Eliminar mensaje"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      {/* Reaction Trigger */}
                      <div className="relative">
                        <button 
                          onClick={() => setReactingToMessageId(reactingToMessageId === msg.id ? null : msg.id)}
                          className="p-1 text-gold/20 hover:text-gold/60 transition-colors"
                        >
                          <Smile size={12} />
                        </button>
                        
                        <AnimatePresence>
                          {reactingToMessageId === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8, y: 10 }}
                              className={`absolute bottom-full mb-2 p-2 bg-black-soft border border-gold/20 rounded-2xl shadow-2xl flex items-center space-x-2 z-20 ${isOwn ? 'right-0' : 'left-0'}`}
                            >
                              {['❤️', '😂', '😮', '😢', '🔥', '👍'].map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(msg.id, emoji)}
                                  className="text-lg hover:scale-125 transition-transform p-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Input */}
      <footer className="p-4 bg-black border-t border-gold/10">
        {chatData?.mutedParticipants?.includes(user?.uid) ? (
          <div className="flex items-center justify-center space-x-3 py-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-rose-500">
            <VolumeX size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Has sido silenciado por un moderador</span>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <button type="button" className="p-2 text-gold/40 hover:text-gold transition-colors">
                <Smile size={24} />
              </button>
              {chatData?.type === 'group' && (
                <button 
                  type="button" 
                  onClick={() => setShowCreatePoll(true)}
                  className="p-2 text-gold/40 hover:text-gold transition-colors"
                  title="Crear encuesta"
                >
                  <BarChart2 size={24} />
                </button>
              )}
            </div>
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
        )}
      </footer>

      {/* Group Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-black-soft border border-gold/20 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gold/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gold/10 text-gold rounded-xl">
                    <Users size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-white">Ajustes del grupo</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-gold/40 hover:text-gold transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Group Info */}
                <div className="text-center pb-6 border-b border-gold/5">
                  <div className="w-20 h-20 bg-gold/10 rounded-3xl flex items-center justify-center text-gold text-3xl font-bold mx-auto mb-4 border border-gold/20">
                    {chatData?.name?.[0] || 'G'}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{chatData?.name}</h3>
                  <p className="text-[10px] text-gold/40 uppercase tracking-widest font-bold">
                    {chatData?.participants?.length} miembros
                  </p>
                </div>

                {/* Members List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold text-gold/40 uppercase tracking-widest">Miembros</h4>
                    {chatData?.moderatorId === user?.uid && (
                      <button 
                        onClick={() => setShowAddMember(true)}
                        className="text-[10px] font-bold text-gold hover:underline flex items-center space-x-1"
                      >
                        <UserPlus size={12} />
                        <span>Añadir</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {groupMembers.map(member => {
                      const isModerator = member.uid === chatData?.moderatorId;
                      const isMuted = chatData?.mutedParticipants?.includes(member.uid);
                      const isMe = member.uid === user?.uid;

                      return (
                        <div key={member.uid} className="flex items-center justify-between p-3 bg-black rounded-2xl border border-gold/5">
                          <div className="flex items-center space-x-3">
                            <img src={member.photoURL || `https://ui-avatars.com/api/?name=${member.username}`} className="w-10 h-10 rounded-xl object-cover border border-gold/10" referrerPolicy="no-referrer" />
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-bold text-white">@{member.username}</p>
                                {isModerator && (
                                  <span className="px-1.5 py-0.5 bg-gold/10 text-gold text-[8px] font-bold rounded border border-gold/20 uppercase">Mod</span>
                                )}
                              </div>
                              <p className="text-[10px] text-gold/40">{member.displayName}</p>
                            </div>
                          </div>
                          
                          {chatData?.moderatorId === user?.uid && !isMe && (
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={() => handleToggleMute(member.uid)}
                                className={`p-2 rounded-xl transition-colors ${isMuted ? 'text-rose-500 bg-rose-500/10' : 'text-gold/40 hover:bg-gold/10 hover:text-gold'}`}
                                title={isMuted ? "Quitar silencio" : "Silenciar"}
                              >
                                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                              </button>
                              <button 
                                onClick={() => handleRemoveMember(member.uid)}
                                className="p-2 text-gold/40 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-colors"
                                title="Eliminar del grupo"
                              >
                                <UserMinus size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Moderator Actions */}
                {chatData?.moderatorId === user?.uid && (
                  <div className="pt-6 border-t border-gold/5">
                    <button 
                      onClick={handleDeleteGroup}
                      className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-bold hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center space-x-2"
                    >
                      <Trash2 size={18} />
                      <span>Eliminar grupo</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-black-soft border border-gold/20 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gold/10 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Añadir miembro</h2>
                <button onClick={() => setShowAddMember(false)} className="text-gold/40 hover:text-gold transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {followingList.filter(f => !chatData?.participants?.includes(f.uid)).length > 0 ? (
                  followingList
                    .filter(f => !chatData?.participants?.includes(f.uid))
                    .map(u => (
                      <button
                        key={u.uid}
                        onClick={() => handleAddMember(u.uid)}
                        className="w-full flex items-center space-x-3 p-3 bg-black rounded-2xl border border-gold/5 hover:border-gold/30 transition-all group"
                      >
                        <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-white group-hover:text-gold transition-colors">@{u.username}</p>
                          <p className="text-[10px] text-gold/40">{u.displayName}</p>
                        </div>
                        <UserPlus size={18} className="text-gold/40 group-hover:text-gold transition-colors" />
                      </button>
                    ))
                ) : (
                  <p className="text-center py-8 text-gold/40 text-xs italic">No hay más amigos para añadir.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Poll Modal */}
      <AnimatePresence>
        {showCreatePoll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-black-soft border border-gold/20 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gold/10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gold/10 text-gold rounded-xl">
                    <BarChart2 size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-white">Crear encuesta</h2>
                </div>
                <button onClick={() => setShowCreatePoll(false)} className="text-gold/40 hover:text-gold transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-gold/40 uppercase tracking-widest mb-2">Pregunta</label>
                  <input 
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="¿Qué te parece...?"
                    className="w-full px-4 py-3 bg-black rounded-2xl border border-gold/10 focus:ring-2 focus:ring-gold outline-none text-sm text-white placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-gold/40 uppercase tracking-widest mb-2">Opciones</label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="relative">
                      <input 
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = e.target.value;
                          setPollOptions(newOpts);
                        }}
                        placeholder={`Opción ${idx + 1}`}
                        className="w-full px-4 py-3 bg-black rounded-2xl border border-gold/10 focus:ring-2 focus:ring-gold outline-none text-sm text-white placeholder:text-slate-600"
                      />
                      {pollOptions.length > 2 && (
                        <button 
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/40 hover:text-rose-500"
                        >
                          <Plus size={18} className="rotate-45" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button 
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="w-full py-2 border border-dashed border-gold/20 rounded-xl text-[10px] font-bold text-gold/40 hover:text-gold hover:border-gold/40 transition-all uppercase tracking-widest"
                    >
                      + Añadir opción
                    </button>
                  )}
                </div>

                <button
                  onClick={handleCreatePoll}
                  disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                  className="w-full py-4 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all shadow-lg shadow-gold/20 disabled:opacity-50"
                >
                  Crear Encuesta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReportModal && reportTargetId && (
          <ReportModal 
            targetId={reportTargetId}
            targetType="message"
            onClose={() => {
              setShowReportModal(false);
              setReportTargetId(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
