import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, writeBatch, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { UserCheck, UserX, Clock, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const FollowRequestsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    console.log("Listening for follow requests for user:", user.uid);
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'followRequests'),
      (snapshot) => {
        console.log("Follow requests snapshot received:", snapshot.size, "requests");
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error in follow requests snapshot:", error);
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/followRequests`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async (request: any) => {
    if (!user) return;

    const requesterId = request.id || request.requesterId;
    if (!requesterId) {
      console.error("No requesterId found in request:", request);
      setError("Error: No se pudo identificar al solicitante.");
      return;
    }

    console.log("Accepting follow request from:", requesterId);
    setProcessingId(requesterId);
    setError(null);

    try {
      const batch = writeBatch(db);

      // 1. Add to followers of current user
      const followerRef = doc(db, 'users', user.uid, 'followers', requesterId);
      batch.set(followerRef, {
        uid: requesterId,
        followedAt: new Date().toISOString()
      });

      // 2. Add to following of requester
      const followingRef = doc(db, 'users', requesterId, 'following', user.uid);
      batch.set(followingRef, {
        uid: user.uid,
        followedAt: new Date().toISOString()
      });

      // 3. Delete the request
      const requestRef = doc(db, 'users', user.uid, 'followRequests', requesterId);
      batch.delete(requestRef);

      console.log("Committing batch for follow request acceptance...");
      await batch.commit();
      console.log("Follow request accepted successfully");

      // 4. Create notification for the requester
      await addDoc(collection(db, 'users', requesterId, 'notifications'), {
        type: 'follow_accept',
        fromUserId: user.uid,
        fromUserName: profile?.username || user.displayName || 'usuario',
        fromUserPhoto: profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=random`,
        text: 'ha aceptado tu solicitud de seguimiento',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Error accepting follow request:", err);
      setError(`Error al aceptar la solicitud: ${err.message || 'Error desconocido'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user) return;

    console.log("Rejecting follow request:", requestId);
    setProcessingId(requestId);
    setError(null);

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'followRequests', requestId));
      console.log("Follow request rejected successfully");
    } catch (err: any) {
      console.error("Error rejecting follow request:", err);
      setError(`Error al rechazar la solicitud: ${err.message || 'Error desconocido'}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto bg-black min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-3">
          <Bell className="text-gold" />
          <span>Solicitudes de Seguimiento</span>
        </h1>
        <p className="text-gold/60 mt-2">Gestiona quién puede ver tu contenido privado.</p>
      </header>

      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-sm">
            {error}
          </div>
        )}
        <AnimatePresence>
          {requests.length > 0 ? (
            requests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between p-4 bg-black-soft rounded-2xl border border-gold/20"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={req.requesterPhoto || `https://ui-avatars.com/api/?name=${req.requesterName}&background=random`}
                    alt={req.requesterName}
                    className="w-12 h-12 rounded-full border border-gold/20 object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://ui-avatars.com/api/?name=${req.requesterName}&background=random`;
                    }}
                  />
                  <div>
                    <h3 className="font-bold text-white">@{req.requesterName}</h3>
                    <p className="text-xs text-gold/40 flex items-center space-x-1">
                      <Clock size={12} />
                      <span>
                        {req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true, locale: es }) : 'Recientemente'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={processingId === req.id}
                    className={`p-2 bg-gold text-black rounded-xl hover:bg-gold/80 transition-colors ${
                      processingId === req.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Aceptar"
                  >
                    {processingId === req.id ? (
                      <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                      <UserCheck size={20} />
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={processingId === req.id}
                    className="p-2 bg-black-soft border border-gold/20 text-gold rounded-xl hover:bg-gold/10 transition-colors"
                    title="Rechazar"
                  >
                    <UserX size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-black-soft rounded-3xl border border-dashed border-gold/20">
              <Bell size={48} className="mx-auto text-gold/20 mb-4" />
              <h3 className="text-xl font-bold text-gold mb-2">No hay solicitudes</h3>
              <p className="text-gold/60 max-w-xs mx-auto">
                Cuando alguien solicite seguirte, aparecerá aquí.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
