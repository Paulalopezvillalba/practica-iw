import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Clock, AlertTriangle, Shield, Zap, Moon } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const WellbeingPage: React.FC = () => {
  const { profile } = useAuth();
  const [limit, setLimit] = useState(profile?.usageLimitMinutes || 60);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.usageLimitMinutes) {
      setLimit(profile.usageLimitMinutes);
    }
  }, [profile]);

  const handleSaveLimit = async () => {
    if (!profile?.uid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        usageLimitMinutes: limit
      });
    } catch (error) {
      console.error("Error saving limit:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const stats = [
    { label: 'Hoy', value: '42 min', icon: Clock, color: 'text-gold', bg: 'bg-gold/10' },
    { label: 'Media semanal', value: '55 min', icon: Zap, color: 'text-gold', bg: 'bg-gold/10' },
    { label: 'Alertas hoy', value: '1', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto bg-black min-h-screen">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-white tracking-tight">Bienestar Digital</h1>
        <p className="text-gold/60">Gestiona tu tiempo y mantén una relación saludable con la tecnología.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon size={24} />
            </div>
            <p className="text-gold/40 text-sm font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <section className="bg-black-soft p-8 rounded-3xl border border-gold/20 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Límite diario</h2>
                <p className="text-gold/40 text-sm">Te avisaremos cuando alcances este tiempo.</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-gold">{limit}</span>
              <span className="text-gold/40 font-medium ml-2">min</span>
            </div>
          </div>

          <input 
            type="range" 
            min="15" 
            max="180" 
            step="15"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-gold mb-8"
          />

          <div className="flex justify-end">
            <button 
              onClick={handleSaveLimit}
              disabled={isSaving || limit === profile?.usageLimitMinutes}
              className="px-8 py-3 bg-gold text-black rounded-xl font-bold hover:bg-gold-light transition-all disabled:opacity-50 shadow-lg shadow-gold/20"
            >
              {isSaving ? 'Guardando...' : 'Actualizar límite'}
            </button>
          </div>
        </section>

        <section className="bg-gradient-to-br from-black-soft to-black text-white p-8 rounded-3xl shadow-2xl border border-gold/10 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Moon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Modo Pausa</h2>
                <p className="text-gold/40 text-sm">Desactiva las notificaciones durante la noche.</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-black rounded-2xl border border-gold/10">
              <span className="font-medium text-gold/80">Activar automáticamente</span>
              <div className="w-12 h-6 bg-gold rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 bg-black rounded-full" />
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl -mr-32 -mt-32" />
        </section>
      </div>
    </div>
  );
};
