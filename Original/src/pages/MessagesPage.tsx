import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Users, Search, Plus, ChevronRight, UserPlus, Info, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SuggestedUser {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  isPrivate: boolean;
}

export const MessagesPage: React.FC = () => {
  const { user, profile: currentUserProfile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [followingList, setFollowingList] = useState<SuggestedUser[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!user) return;

    // Fetch Chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribeChats = onSnapshot(chatsQuery, async (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const detailedChats = await Promise.all(
        chatList.map(async (chat: any) => {
          if (chat.type === 'individual') {
            const otherId = chat.participants.find((p: string) => p !== user.uid);
            if (otherId) {
              const uDoc = await getDoc(doc(db, 'users', otherId));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                return {
                  ...chat,
                  otherUser: {
                    username: uData.username,
                    photoURL: uData.photoURL
                  }
                };
              }
            }
          }
          return chat;
        })
      );

      setChats(detailedChats);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    // Fetch Pending Message Requests
    const requestsQuery = query(
      collection(db, 'messageRequests'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      setPendingRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Suggested Users (Following who don't have a chat yet)
    const followingRef = collection(db, 'users', user.uid, 'following');
    const unsubscribeFollowing = onSnapshot(followingRef, async (snapshot) => {
      const followingIds = snapshot.docs.map(doc => doc.id);
      
      // Filter out those who already have a chat
      // Note: This is a bit complex with Firestore queries, so we'll do it client-side for now
      // as the number of following is usually manageable.
      const usersWithChats = new Set();
      chats.forEach(chat => {
        chat.participants.forEach((pId: string) => {
          if (pId !== user.uid) usersWithChats.add(pId);
        });
      });

      const potentialSuggestions = followingIds.filter(id => !usersWithChats.has(id));
      
      const detailedUsers = await Promise.all(
        potentialSuggestions.slice(0, 10).map(async (id) => {
          const userDoc = await getDoc(doc(db, 'users', id));
          if (userDoc.exists()) {
            const data = userDoc.data();
            return {
              uid: id,
              username: data.username || 'Usuario',
              displayName: data.displayName || '',
              photoURL: data.photoURL || '',
              isPrivate: data.isPrivate || false
            };
          }
          return null;
        })
      );

      setSuggestedUsers(detailedUsers.filter(u => u !== null) as SuggestedUser[]);
    });

    // Fetch All Following for Group Creation
    const fetchFollowing = async () => {
      const followingRef = collection(db, 'users', user.uid, 'following');
      const snapshot = await getDoc(doc(db, 'users', user.uid)); // Just to trigger if needed, but we use onSnapshot below
      
      const unsubscribeFollowingFull = onSnapshot(followingRef, async (snap) => {
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
                photoURL: data.photoURL || '',
                isPrivate: data.isPrivate || false
              };
            }
            return null;
          })
        );
        setFollowingList(detailedUsers.filter(u => u !== null) as SuggestedUser[]);
      });
      return unsubscribeFollowingFull;
    };

    let unsubFollowingFull: () => void;
    fetchFollowing().then(unsub => unsubFollowingFull = unsub);

    return () => {
      unsubscribeChats();
      unsubscribeRequests();
      unsubscribeFollowing();
      if (unsubFollowingFull) unsubFollowingFull();
    };
  }, [user, chats.length]); // Re-run when chats length changes to update suggestions

  const handleCreateGroup = async () => {
    if (!user || !currentUserProfile || !groupName.trim() || selectedMembers.length === 0) return;
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const chatRef = await addDoc(collection(db, 'chats'), {
        name: groupName.trim(),
        type: 'group',
        participants: [user.uid, ...selectedMembers],
        moderatorId: user.uid,
        mutedParticipants: [],
        lastMessage: 'Grupo creado',
        lastMessageAt: now,
        createdAt: now,
        lastReadAt: {
          [user.uid]: now
        }
      });

      setNotification({ message: "Grupo creado correctamente.", type: 'success' });
      setShowCreateGroup(false);
      setGroupName('');
      setSelectedMembers([]);
      navigate(`/messages/${chatRef.id}`);
    } catch (error) {
      console.error("Error creating group:", error);
      setNotification({ message: "Error al crear el grupo.", type: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (uid: string) => {
    setSelectedMembers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleStartConversation = async (targetUser: SuggestedUser) => {
    if (!user || !currentUserProfile) return;
    setProcessingId(targetUser.uid);

    try {
      if (targetUser.isPrivate) {
        // Use a predictable ID for the request to avoid duplicates and check existence easily
        const requestId = `${user.uid}_${targetUser.uid}`;
        const existingRequest = await getDoc(doc(db, 'messageRequests', requestId));
        
        if (existingRequest.exists()) {
          setNotification({ message: "Ya has enviado una solicitud a este usuario.", type: 'info' });
        } else {
          await setDoc(doc(db, 'messageRequests', requestId), {
            fromId: user.uid,
            toId: targetUser.uid,
            fromName: currentUserProfile.username,
            fromPhoto: currentUserProfile.photoURL || '',
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          setNotification({ message: "Solicitud de mensaje enviada correctamente.", type: 'success' });
        }
      } else {
        // Create direct chat
        const now = new Date().toISOString();
        const chatRef = await addDoc(collection(db, 'chats'), {
          participants: [user.uid, targetUser.uid],
          type: 'individual',
          lastMessage: '',
          lastMessageAt: now,
          createdAt: now,
          lastReadAt: {
            [user.uid]: now
          }
        });
        navigate(`/messages/${chatRef.id}`);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-black relative">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-0 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl border flex items-center space-x-3 min-w-[300px] ${
              notification.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                : 'bg-gold/10 border-gold/20 text-gold'
            }`}
          >
            <Info size={20} />
            <span className="font-bold text-sm">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat List */}
      <div className="w-full max-w-md border-r border-gold/10 flex flex-col bg-black">
        <header className="p-6 border-b border-gold/10 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Mensajes</h1>
          <div className="flex items-center space-x-2">
            {pendingRequests.length > 0 && (
              <Link 
                to="/messages/requests"
                className="relative p-2 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-colors"
                title="Solicitudes de mensaje"
              >
                <UserPlus size={24} />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
                  {pendingRequests.length}
                </span>
              </Link>
            )}
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="p-2 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-colors"
              title="Crear grupo"
            >
              <Users size={24} />
            </button>
            <button 
              onClick={() => setShowNewChat(true)}
              className="p-2 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-colors"
              title="Nuevo mensaje"
            >
              <Plus size={24} />
            </button>
          </div>
        </header>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/40" size={18} />
            <input 
              type="text"
              placeholder="Buscar chats..."
              className="w-full pl-10 pr-4 py-3 bg-black-soft rounded-2xl border border-gold/10 focus:ring-2 focus:ring-gold outline-none text-sm text-white placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Suggested Section */}
        {suggestedUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-gold/5">
            <h2 className="text-[10px] font-bold text-gold/40 uppercase tracking-widest mb-3">Sugerencias</h2>
            <div className="flex space-x-4 overflow-x-auto pb-4 no-scrollbar">
              {suggestedUsers.map(u => (
                <button
                  key={u.uid}
                  onClick={() => handleStartConversation(u)}
                  disabled={processingId === u.uid}
                  className="flex flex-col items-center space-y-1 min-w-[70px] group"
                >
                  <div className="relative">
                    <img 
                      src={u.photoURL || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                      alt={u.username}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-gold/10 group-hover:border-gold transition-all"
                    />
                    {u.isPrivate && (
                      <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-gold/20">
                        <Lock size={10} className="text-gold" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-white/60 truncate w-16 text-center group-hover:text-gold transition-colors">
                    @{u.username}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Message Requests Inbox Item - Always visible if there are requests */}
          {pendingRequests.length > 0 && (
            <div className="p-2">
              <Link 
                to="/messages/requests"
                className="flex items-center space-x-4 p-4 bg-gold/5 hover:bg-gold/10 transition-all rounded-3xl border border-gold/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/5 to-gold/0 animate-shimmer" />
                <div className="relative">
                  <div className="w-14 h-14 bg-gold/20 rounded-2xl border border-gold/30 flex items-center justify-center text-gold shadow-lg shadow-gold/10">
                    <UserPlus size={28} />
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black animate-pulse shadow-lg">
                      {pendingRequests.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gold group-hover:text-gold-light transition-colors tracking-tight">
                      Bandeja de solicitudes
                    </h3>
                  </div>
                  <p className="text-xs text-gold/60 truncate font-medium">
                    Tienes {pendingRequests.length} {pendingRequests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gold/40 group-hover:text-gold transition-all group-hover:translate-x-1" />
              </Link>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gold/40 italic">Cargando chats...</div>
          ) : chats.length > 0 ? (
            chats.map(chat => (
              <Link 
                key={chat.id}
                to={`/messages/${chat.id}`}
                className="flex items-center space-x-4 p-4 hover:bg-gold/5 transition-colors group border-b border-gold/5"
              >
                <div className="relative">
                  <div className="w-14 h-14 bg-black-soft rounded-2xl border border-gold/10 flex items-center justify-center text-gold/40 overflow-hidden">
                    {chat.type === 'group' ? <Users size={28} /> : (
                      <img 
                        src={chat.otherUser?.photoURL || `https://ui-avatars.com/api/?name=${chat.otherUser?.username || 'Chat'}&background=random`} 
                        alt="Chat" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-bold truncate group-hover:text-gold transition-colors ${
                      (chat.lastMessageAt || '0') > (chat.lastReadAt?.[user.uid] || '0') 
                        ? 'text-white' 
                        : 'text-gold/60'
                    }`}>
                      {chat.name || (chat.otherUser ? `@${chat.otherUser.username}` : 'Chat privado')}
                    </h3>
                    {chat.lastMessageAt && (
                      <span className={`text-[10px] font-medium whitespace-nowrap ${
                        (chat.lastMessageAt || '0') > (chat.lastReadAt?.[user.uid] || '0')
                          ? 'text-gold'
                          : 'text-gold/40'
                      }`}>
                        {formatDistanceToNow(new Date(chat.lastMessageAt), { locale: es })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate group-hover:text-gold/80 transition-colors ${
                      (chat.lastMessageAt || '0') > (chat.lastReadAt?.[user.uid] || '0')
                        ? 'text-gold font-bold'
                        : 'text-gold/40'
                    }`}>
                      {chat.lastMessage || 'Inicia una conversación...'}
                    </p>
                    {(chat.lastMessageAt || '0') > (chat.lastReadAt?.[user.uid] || '0') && (
                      <div className="w-2 h-2 bg-gold rounded-full shadow-lg shadow-gold/20 ml-2 flex-shrink-0" />
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gold/20 group-hover:text-gold transition-colors" />
              </Link>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 text-gold/40">
                <MessageCircle size={32} />
              </div>
              <p className="text-gold/60 font-medium">No tienes mensajes todavía</p>
              <button 
                onClick={() => setShowNewChat(true)}
                className="mt-4 text-gold font-bold hover:underline"
              >
                Enviar un mensaje
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Welcome / Placeholder for Chat Window */}
      <div className="hidden md:flex flex-1 bg-black flex items-center justify-center p-12">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 bg-black-soft rounded-3xl shadow-2xl border border-gold/20 flex items-center justify-center mx-auto mb-8 text-gold">
            <MessageCircle size={48} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Tus mensajes privados</h2>
          <p className="text-gold/60 leading-relaxed">
            Envía fotos y mensajes privados a tus amigos. Recuerda mantener siempre un tono respetuoso.
          </p>
          <div className="flex flex-col space-y-3 mt-8 w-full">
            <button 
              onClick={() => setShowNewChat(true)}
              className="w-full px-8 py-3 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all shadow-lg shadow-gold/20"
            >
              Nuevo mensaje
            </button>
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="w-full px-8 py-3 bg-black-soft text-gold border border-gold/20 rounded-2xl font-bold hover:bg-gold/10 transition-all"
            >
              Crear grupo
            </button>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-black-soft border border-gold/20 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gold/10 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Crear nuevo grupo</h2>
                <button onClick={() => setShowCreateGroup(false)} className="text-gold/40 hover:text-gold transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-gold/40 uppercase tracking-widest mb-2">Nombre del grupo</label>
                  <input 
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ej: Amigos de la Universidad"
                    className="w-full px-4 py-3 bg-black rounded-2xl border border-gold/10 focus:ring-2 focus:ring-gold outline-none text-sm text-white placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gold/40 uppercase tracking-widest mb-2">Seleccionar miembros ({selectedMembers.length})</label>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {followingList.length > 0 ? (
                      followingList.map(u => (
                        <button
                          key={u.uid}
                          onClick={() => toggleMemberSelection(u.uid)}
                          className={`w-full flex items-center space-x-3 p-3 rounded-2xl border transition-all ${
                            selectedMembers.includes(u.uid)
                              ? 'bg-gold/10 border-gold/40'
                              : 'bg-black border-gold/5 hover:border-gold/20'
                          }`}
                        >
                          <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-white">@{u.username}</p>
                            <p className="text-[10px] text-gold/40">{u.displayName}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedMembers.includes(u.uid) ? 'bg-gold border-gold' : 'border-gold/20'
                          }`}>
                            {selectedMembers.includes(u.uid) && <Plus size={14} className="text-black rotate-45" />}
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-center py-4 text-gold/40 text-xs italic">No sigues a nadie todavía.</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || selectedMembers.length === 0 || loading}
                  className="w-full py-4 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all shadow-lg shadow-gold/20 disabled:opacity-50"
                >
                  {loading ? 'Creando...' : 'Crear Grupo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MessagesPage;
