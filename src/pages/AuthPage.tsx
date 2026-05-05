import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        // Age verification
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }

        if (age < 18) {
          throw new Error('Debes ser mayor de edad para registrarte en Original.');
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9._-]+$/;
        if (!usernameRegex.test(username)) {
          throw new Error('El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos.');
        }

        if (username.length < 3 || username.length > 30) {
          throw new Error('El nombre de usuario debe tener entre 3 y 30 caracteres.');
        }

        // Check for username uniqueness
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const usernameSnapshot = await getDocs(usernameQuery);
        if (!usernameSnapshot.empty) {
          throw new Error('El nombre de usuario ya está en uso. Por favor, elige otro.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          username: username.toLowerCase(),
          isPrivate: false,
          status: 'active',
          role: 'user',
          createdAt: new Date().toISOString(),
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        });

        await setDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
          email,
          birthDate,
          usageLimitMinutes: 60,
        });

        await updateProfile(user, {
          displayName: username,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        });

        navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user document exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        let baseUsername = (user.displayName || 'usuario').toLowerCase().replace(/[^a-z0-9._-]/g, '_');
        let finalUsername = baseUsername;
        let isUnique = false;
        let counter = 1;

        while (!isUnique) {
          const uQuery = query(collection(db, 'users'), where('username', '==', finalUsername));
          const uSnapshot = await getDocs(uQuery);
          if (uSnapshot.empty) {
            isUnique = true;
          } else {
            finalUsername = `${baseUsername}${counter}`;
            counter++;
          }
        }

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          username: finalUsername,
          isPrivate: false,
          status: 'active',
          role: 'user',
          createdAt: new Date().toISOString(),
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        });

        await setDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
          email: user.email,
          usageLimitMinutes: 60,
        });
      }
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need to show a scary error
        return;
      }
      if (err.code === 'auth/cancelled-popup-request') {
        // Another popup was opened, ignore this one
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para iniciar sesión.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('El inicio de sesión con Google no está habilitado en la consola de Firebase. Por favor, actívalo en Authentication > Sign-in method.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-black-soft rounded-3xl shadow-2xl overflow-hidden border border-gold/20"
      >
        <div className="p-8">
          <div className="text-center mb-8 flex flex-col items-center">
            <Logo size="xl" className="mb-2" variant="gold" />
            <p className="text-gold/60 font-medium">
              {isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta consciente'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gold/80 mb-1">Nombre de usuario</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-gold/20 text-white focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    placeholder="usuario123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gold/80 mb-1">Fecha de nacimiento</label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-gold/20 text-white focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gold/80 mb-1">Correo electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gold/20 text-white focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gold/80 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gold/20 text-white focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gold text-black rounded-2xl font-bold text-lg hover:bg-gold-light transition-all shadow-lg shadow-gold/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Registrarse'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gold/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black-soft text-gold/40">O continúa con</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 bg-black border border-gold/20 rounded-2xl font-semibold text-gold/80 hover:bg-white/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Google
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gold/60 font-medium hover:text-gold transition-colors"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
