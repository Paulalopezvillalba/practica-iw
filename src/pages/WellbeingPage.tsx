import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Shield, 
  Moon, 
  ChevronRight, 
  ArrowLeft, 
  Save,
  Check,
  AlertCircle,
  BarChart3,
  Timer,
  Coffee,
  Ban
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const WellbeingPage: React.FC = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [usageLimit, setUsageLimit] = useState(profile?.usageLimitMinutes || 60);
  const [pauseMode, setPauseMode] = useState(profile?.pauseModeEnabled || false);
  const [feedPauses, setFeedPauses] = useState(profile?.feedPausesEnabled || false);
  
  const [stats, setStats] = useState({
    today: 0,
    avg: 0,
    alerts: 0
  });

  useEffect(() => {
    if (profile) {
      setUsageLimit(profile.usageLimitMinutes || 60);
      setPauseMode(profile.pauseModeEnabled || false);
      setFeedPauses(profile.feedPausesEnabled || false);
    }
  }, [profile]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'usageLogs'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc'),
          limit(7)
        );
        const snap = await getDocs(q);
        const logs = snap.docs.map(doc => doc.data());
        
        const todayStr = new Date().toISOString().split('T')[0];
        const todayLog = logs.find(l => l.date === todayStr);
        const todayMinutes = todayLog?.minutesUsed || 0;
        
        const totalMinutes = logs.reduce((acc, curr) => acc + curr.minutesUsed, 0);
        const avgMinutes = logs.length > 0 ? Math.round(totalMinutes / logs.length) : 0;
        
        const alertsCount = logs.filter(l => profile?.usageLimitMinutes && l.minutesUsed >= profile.usageLimitMinutes).length;

        setStats({
          today: todayMinutes,
          avg: avgMinutes,
          alerts: alertsCount
        });
      } catch (err) {
        console.error("Error fetching usage stats:", err);
      }
    };

    fetchStats();
  }, [user, profile?.usageLimitMinutes]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        usageLimitMinutes: usageLimit,
        pauseModeEnabled: pauseMode,
        feedPausesEnabled: feedPauses,
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const isOverLimit = profile?.usageLimitMinutes && stats.today >= profile.usageLimitMinutes;

  return (
    <div className="min-h-screen bg-black pb-24 lg:pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-gold/20 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 text-gold/60 hover:text-gold transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Bienestar Digital</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-gold text-black rounded-xl font-bold text-sm hover:bg-gold-light transition-all disabled:opacity-50 flex items-center space-x-2"
        >
          {success ? <Check size={18} /> : <Save size={18} />}
          <span>{loading ? 'Guardando...' : success ? 'Guardado' : 'Guardar'}</span>
        </button>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Usage Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-black-soft p-4 rounded-3xl border border-gold/10 text-center space-y-1">
            <p className="text-[10px] font-bold text-gold/40 uppercase tracking-widest">Hoy</p>
            <p className="text-2xl font-black text-white">{stats.today}<span className="text-xs text-gold/40 ml-1">min</span></p>
          </div>
          <div className="bg-black-soft p-4 rounded-3xl border border-gold/10 text-center space-y-1">
            <p className="text-[10px] font-bold text-gold/40 uppercase tracking-widest">Media</p>
            <p className="text-2xl font-black text-white">{stats.avg}<span className="text-xs text-gold/40 ml-1">min</span></p>
          </div>
          <div className="bg-black-soft p-4 rounded-3xl border border-gold/10 text-center space-y-1">
            <p className="text-[10px] font-bold text-gold/40 uppercase tracking-widest">Alertas</p>
            <p className="text-2xl font-black text-rose-500">{stats.alerts}</p>
          </div>
        </div>

        {/* Usage Limit Section */}
        <section className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
              <Timer size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Límite Diario</h2>
              <p className="text-gold/40 text-sm">Establece cuánto tiempo quieres usar la app.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gold/60">Tiempo seleccionado</span>
              <span className="text-gold">{usageLimit} minutos</span>
            </div>
            <input 
              type="range" 
              min="15" 
              max="300" 
              step="15"
              value={usageLimit}
              onChange={(e) => setUsageLimit(parseInt(e.target.value))}
              className="w-full h-2 bg-gold/10 rounded-lg appearance-none cursor-pointer accent-gold"
            />
            <div className="flex justify-between text-[10px] text-gold/20 font-bold uppercase tracking-widest">
              <span>15 min</span>
              <span>5 horas</span>
            </div>
          </div>

          {isOverLimit && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center space-x-3">
              <AlertCircle size={20} className="text-rose-500 shrink-0" />
              <p className="text-rose-500 text-xs font-medium">
                Has superado tu límite de hoy. Te recomendamos tomar un descanso.
              </p>
            </div>
          )}
        </section>

        {/* Pause Mode Section */}
        <section className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Moon size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Modo Pausa</h2>
                <p className="text-gold/40 text-sm">Desactiva notificaciones por la noche.</p>
              </div>
            </div>
            <button 
              onClick={() => setPauseMode(!pauseMode)}
              className={`w-14 h-8 rounded-full transition-all relative ${pauseMode ? 'bg-gold' : 'bg-slate-800'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${pauseMode ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          
          <div className="p-4 bg-gold/5 rounded-2xl border border-gold/10">
            <p className="text-gold/60 text-xs leading-relaxed">
              El Modo Pausa silenciará todas las notificaciones de 22:00 a 08:00 para ayudarte a desconectar antes de dormir.
            </p>
          </div>
        </section>

        {/* Feed Pauses Section */}
        <section className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Coffee size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Pausas en el Feed</h2>
                <p className="text-gold/40 text-sm">Recordatorios para descansar mientras navegas.</p>
              </div>
            </div>
            <button 
              onClick={() => setFeedPauses(!feedPauses)}
              className={`w-14 h-8 rounded-full transition-all relative ${feedPauses ? 'bg-gold' : 'bg-slate-800'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${feedPauses ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          
          <div className="p-4 bg-gold/5 rounded-2xl border border-gold/10">
            <p className="text-gold/60 text-xs leading-relaxed">
              Te mostraremos un mensaje de "Toma un respiro" cada 15 minutos de navegación continua en el feed principal.
            </p>
          </div>
        </section>

        {/* Blocking Mode (Visual only for now) */}
        <section className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl space-y-6 opacity-60 grayscale">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center">
                <Ban size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Bloqueo Estricto</h2>
                <p className="text-gold/40 text-sm">Bloquea el acceso al superar el límite.</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-gold/10 text-gold rounded-full text-[10px] font-bold uppercase tracking-widest">Próximamente</div>
          </div>
        </section>
      </div>
    </div>
  );
};
