import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Shield, Flag } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface ReportModalProps {
  targetId: string;
  targetType: 'post' | 'comment' | 'user' | 'message';
  onClose: () => void;
}

const REPORT_REASONS = [
  'Contenido ofensivo o acoso',
  'Spam o contenido engañoso',
  'Desnudez o contenido sexual',
  'Violencia o contenido gráfico',
  'Infracción de propiedad intelectual',
  'Otro'
];

export const ReportModal: React.FC<ReportModalProps> = ({ targetId, targetType, onClose }) => {
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        targetId,
        targetType,
        reason,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setIsSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      console.error("Error submitting report:", err);
      setError("No se pudo enviar el reporte. Por favor, inténtalo de nuevo.");
      handleFirestoreError(err, OperationType.WRITE, 'reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetLabel = () => {
    switch (targetType) {
      case 'post': return 'publicación';
      case 'comment': return 'comentario';
      case 'user': return 'usuario';
      case 'message': return 'mensaje';
      default: return 'contenido';
    }
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-md"
      />
      <motion.div
        initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.9, y: 20 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-[#1A1A1A] border md:border-2 border-gold rounded-t-[32px] md:rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] relative z-10"
      >
        {isMobile && (
          <div className="w-12 h-1.5 bg-gold rounded-full mx-auto mt-4 mb-2" />
        )}
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gold text-black rounded-xl border-2 border-white/20 shadow-xl">
                <Flag size={24} fill="currentColor" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Reportar {getTargetLabel()}</h2>
                <p className="text-[12px] text-gold font-black uppercase tracking-[0.2em] mt-0.5">Seguridad de la comunidad</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-white hover:text-gold transition-colors active:scale-90 rounded-full bg-white/20 hover:bg-white/30"
            >
              <X size={24} />
            </button>
          </div>

          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center space-y-6"
            >
              <div className="relative mx-auto w-24 h-24">
                <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.3, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-green-400 rounded-full blur-3xl"
                />
                <div className="relative w-full h-full bg-green-500 rounded-full flex items-center justify-center text-white shadow-[0_0_50px_rgba(34,197,94,0.6)] border-4 border-white">
                  <Shield size={48} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-white font-black text-3xl tracking-tight">¡ENVIADO!</p>
                <p className="text-white text-lg max-w-[280px] mx-auto leading-relaxed font-bold">
                  Gracias por tu ayuda. Revisaremos esto ahora mismo.
                </p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-4">
                <p className="text-white font-black text-sm uppercase tracking-widest border-l-4 border-gold pl-3">Elige un motivo:</p>
                <div className="grid grid-cols-1 gap-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`text-left px-6 py-5 rounded-2xl border-2 transition-all text-base font-black active:scale-[0.97] ${
                        reason === r
                          ? 'bg-gold border-white text-black shadow-[0_0_30px_rgba(212,175,55,0.5)]'
                          : 'bg-[#262626] border-white/20 text-white hover:border-gold hover:bg-[#333333]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-5 bg-rose-600 border-4 border-white rounded-2xl text-white text-sm text-center font-black flex items-center justify-center space-x-3 shadow-2xl">
                  <AlertTriangle size={24} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-start space-x-4 p-6 bg-black rounded-2xl border-2 border-gold/30 shadow-inner">
                <AlertTriangle size={28} className="text-gold shrink-0 mt-0.5" />
                <p className="text-[14px] text-white leading-relaxed font-black">
                  Tu reporte es <span className="text-gold underline decoration-2 underline-offset-4">100% ANÓNIMO</span>.
                </p>
              </div>

              <button
                type="submit"
                disabled={!reason || isSubmitting}
                className="w-full py-6 bg-gold text-black font-black uppercase tracking-[0.2em] text-base rounded-2xl hover:bg-gold-light transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-95 flex items-center justify-center space-x-4 border-b-8 border-gold-dark"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-6 h-6 border-4 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>ENVIANDO...</span>
                  </>
                ) : (
                  <>
                    <Flag size={24} fill="currentColor" />
                    <span>ENVIAR REPORTE</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

