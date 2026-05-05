import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Activity,
  User,
  Lock,
  Play,
  RotateCcw,
  Smartphone,
  Gauge,
  AppWindow,
  ShieldAlert,
  Bell
} from 'lucide-react';

// Importar los nuevos módulos de testing
import { testAgeValidation } from '../testing/functionality';
import { testDatabaseIntegrity } from '../testing/database';
import { testPWACompatibility } from '../testing/compatibility';
import { testPerformance } from '../testing/performance';
import { testSecurityLocks } from '../testing/security';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure';
  message: string;
  details?: any;
  icon: React.ReactNode;
}

export const IntegrityTestPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async (
    name: string, 
    icon: React.ReactNode, 
    testFn: () => Promise<{ success: boolean; message: string; details?: any }>
  ) => {
    setResults(prev => [...prev.filter(r => r.name !== name), { 
      name, 
      status: 'running', 
      message: 'Ejecutando análisis...', 
      icon 
    }]);
    
    try {
      const res = await testFn();
      setResults(prev => [...prev.filter(r => r.name !== name), { 
        name, 
        status: res.success ? 'success' : 'failure', 
        message: res.message,
        details: res.details,
        icon
      }]);
      return res.success;
    } catch (error) {
      setResults(prev => [...prev.filter(r => r.name !== name), { 
        name, 
        status: 'failure', 
        message: error instanceof Error ? error.message : 'Error desconocido',
        icon
      }]);
      return false;
    }
  };

  const runAllTests = async () => {
    if (!user) return;
    setIsRunning(true);
    setResults([]);
    
    // Ejecutar los 5 pilares según la imagen
    await runTest('Funcionalidad', <AppWindow size={20} />, () => testAgeValidation(profile?.birthDate || '2005-01-01'));
    await runTest('Bases de Datos', <Database size={20} />, () => testDatabaseIntegrity(user.uid));
    await runTest('Compatibilidad', <Smartphone size={20} />, testPWACompatibility);
    await runTest('Rendimiento', <Gauge size={20} />, () => testPerformance(user.uid));
    await runTest('Seguridad', <ShieldAlert size={20} />, () => testSecurityLocks(user.uid));
    
    setIsRunning(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="pt-safe pb-32 px-4 max-w-4xl mx-auto space-y-12 bg-black min-h-screen font-sans">
      <header className="space-y-4">
        <div className="flex items-center space-x-3 text-gold">
          <Database size={32} className="opacity-80" />
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Integridad de Datos</h1>
        </div>
        <p className="text-gold/60 text-lg">Panel de verificación del sistema y salud de la base de datos.</p>
      </header>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-gold/5 border border-gold/10 rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gold uppercase tracking-widest flex items-center space-x-2">
                <Activity size={20} />
                <span>Estado de Pruebas</span>
              </h2>
              <div className="flex space-x-2">
                <button 
                  onClick={runAllTests}
                  disabled={isRunning}
                  className="flex items-center space-x-2 px-6 py-3 bg-gold text-black rounded-xl font-bold hover:bg-gold-light transition-all disabled:opacity-50"
                >
                  {isRunning ? <RotateCcw className="animate-spin" size={18} /> : <Play size={18} />}
                  <span>{isRunning ? 'Ejecutando...' : 'Iniciar Testing'}</span>
                </button>
                <button 
                  onClick={clearResults}
                  className="p-3 bg-white/5 border border-gold/20 text-gold rounded-xl hover:bg-white/10 transition-all"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {results.length === 0 && !isRunning && (
                <div className="text-center py-12 border border-dashed border-gold/20 rounded-2xl">
                  <p className="text-gold/30 font-medium italic">Presiona "Iniciar Testing" para comenzar el análisis.</p>
                </div>
              )}
              
              <AnimatePresence>
                {results.map((res, index) => (
                  <motion.div 
                    key={res.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${
                      res.status === 'success' ? 'bg-green-500/5 border-green-500/30' :
                      res.status === 'failure' ? 'bg-rose-500/5 border-rose-500/30' :
                      'bg-gold/5 border-gold/20'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        res.status === 'success' ? 'bg-green-500/10 text-green-500' :
                        res.status === 'failure' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-gold/10 text-gold'
                      }`}>
                        {res.status === 'success' ? <CheckCircle2 size={24} /> :
                         res.status === 'failure' ? <AlertCircle size={24} /> :
                         res.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-0.5">{res.name}</h4>
                        <p className={`text-sm ${
                          res.status === 'success' ? 'text-green-500/80' :
                          res.status === 'failure' ? 'text-rose-500/80' :
                          'text-gold/60'
                        }`}>{res.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gold/5 border border-gold/10 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-gold uppercase tracking-[0.2em]">Resumen del Sistema</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gold/40">Usuario actual</p>
                  <p className="text-sm font-mono">{user?.uid.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                  <Lock size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gold/40">Sesión</p>
                  <p className="text-sm">Autenticada</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gold/40">Reglas</p>
                  <p className="text-sm">Activas (v2)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gold text-black rounded-3xl space-y-2">
            <h3 className="font-black italic flex items-center space-x-2">
              <Bell size={18} />
              <span>NOTIFICACIONES</span>
            </h3>
            <p className="text-xs font-bold leading-tight opacity-70">
              Esta herramienta verifica que tus interacciones generen registros íntegros en Firestore.
            </p>
          </div>
        </div>
      </section>

      <footer className="pt-8 border-t border-gold/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 dark:opacity-50">
          <p className="text-gold/30 text-xs font-medium">© 2026 Original Data Integrity System</p>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] px-2 py-0.5 border border-gold/20 rounded text-gold uppercase tracking-widest font-black">Stable</span>
            <span className="text-[10px] px-2 py-0.5 border border-gold/20 rounded text-gold uppercase tracking-widest font-black">Encrypted</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
