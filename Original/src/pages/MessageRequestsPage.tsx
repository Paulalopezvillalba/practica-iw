import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Check, X, MessageSquare, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MessageRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const requestsQuery = query(
      collection(db, 'messageRequests'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(requestsQuery, async (snapshot) => {
      const requestList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const detailedRequests = await Promise.all(
        requestList.map(async (req: any) => {
          const uDoc = await getDoc(doc(db, 'users', req.fromId));
          if (uDoc.exists()) {
            const uData = uDoc.data();
            return {
              ...req,
              sender: {
                username: uData.username,
                displayName: uData.displayName,
                photoURL: uData.photoURL
              }
            };
          }
          return req;
        })
      );

      setRequests(detailedRequests);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messageRequests');
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async (request: any) => {
    if (!user) return;
    setProcessingId(request.id);
    try {
      const now = new Date().toISOString();
      // 1. Create chat
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, request.fromId],
        type: 'individual',
        lastMessage: 'Solicitud aceptada. ¡Di hola!',
        lastMessageAt: now,
        createdAt: now,
        lastReadAt: {
          [user.uid]: now
        }
      });

      // 2. Update request status
      await updateDoc(doc(db, 'messageRequests', request.id), {
        status: 'accepted'
      });

      // 3. Navigate to chat
      navigate(`/messages/${chatRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chats/messageRequests');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await updateDoc(doc(db, 'messageRequests', requestId), {
        status: 'rejected'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `messageRequests/${requestId}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 glass border-b border-gold/20 p-4 flex items-center space-x-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-gold hover:bg-gold/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">Solicitudes de mensaje</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {requests.map((req) => (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-black-soft p-4 rounded-3xl border border-gold/10 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <img 
                      src={req.sender?.photoURL || `https://ui-avatars.com/api/?name=${req.sender?.username || 'User'}&background=random`}
                      alt={req.sender?.username}
                      className="w-14 h-14 rounded-2xl object-cover border border-gold/10"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h3 className="font-bold text-white">@{req.sender?.username || 'Usuario'}</h3>
                      <p className="text-xs text-gold/40">{req.sender?.displayName || 'Quiere enviarte un mensaje'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={processingId === req.id}
                      className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all"
                      title="Rechazar"
                    >
                      <X size={20} />
                    </button>
                    <button
                      onClick={() => handleAccept(req)}
                      disabled={processingId === req.id}
                      className="p-3 bg-gold text-black rounded-2xl font-bold hover:bg-gold-light transition-all shadow-lg shadow-gold/20"
                      title="Aceptar"
                    >
                      <Check size={20} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-black-soft border border-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 text-gold/20">
              <MessageSquare size={40} />
            </div>
            <h3 className="text-xl font-bold text-gold mb-2">No hay solicitudes</h3>
            <p className="text-gold/40">Las solicitudes de mensaje de personas que no conoces aparecerán aquí.</p>
          </div>
        )}
      </div>
    </div>
  );
};
