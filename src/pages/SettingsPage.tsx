import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, writeBatch, deleteDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { motion } from 'motion/react';
import { 
  User, 
  Shield, 
  Bell, 
  ChevronRight, 
  ArrowLeft, 
  Lock, 
  Eye, 
  EyeOff,
  Calendar,
  Mail,
  AtSign,
  Check,
  LogOut,
  Clock,
  Camera,
  Loader2,
  Cloud,
  Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export const SettingsPage: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePhotosConnected, setGooglePhotosConnected] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    firstName: '',
    lastName: '',
    bio: '',
    birthDate: '',
    isPrivate: false,
    photoURL: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        displayName: profile.displayName || '',
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        bio: profile.bio || '',
        birthDate: profile.birthDate || '',
        isPrivate: profile.isPrivate || false,
        photoURL: profile.photoURL || ''
      });
    }
  }, [profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploading(true);
    setError(null);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, photoURL: url }));
    } catch (err: any) {
      console.error("Error uploading file:", err);
      if (err.code === 'storage/unauthorized' || err.code === 'storage/retry-limit-exceeded') {
        setError("Error de permisos: Asegúrate de haber activado Firebase Storage en la consola de Firebase.");
      } else {
        setError("Error al subir la imagen. Verifica tu conexión o activa Firebase Storage.");
      }
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_PHOTOS_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        localStorage.setItem('google_photos_tokens', JSON.stringify(tokens));
        setGooglePhotosConnected(true);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Check if already connected
    const storedTokens = localStorage.getItem('google_photos_tokens');
    if (storedTokens) setGooglePhotosConnected(true);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGooglePhotos = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_photos_auth', 'width=600,height=700');
    } catch (err) {
      console.error("Error connecting to Google Photos:", err);
      setError("No se pudo conectar con Google Photos.");
    }
  };

  const handleDisconnectGooglePhotos = () => {
    localStorage.removeItem('google_photos_tokens');
    setGooglePhotosConnected(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteLoading(true);
    setError(null);
    try {
      // 1. Delete user data in Firestore
      const batch = writeBatch(db);
      
      // Delete public profile
      batch.delete(doc(db, 'users', user.uid));
      
      // Delete private settings
      batch.delete(doc(db, 'users', user.uid, 'private', 'settings'));
      
      // Commit the batch
      await batch.commit();
      
      // 2. Delete the user from Firebase Auth
      await deleteUser(user);
      
      // Sign out is implicit on deleteUser, but let's be safe
      await signOut();
      navigate('/auth');
    } catch (err: any) {
      console.error("Error deleting account:", err);
      if (err.code === 'auth/requires-recent-login') {
        setError("Por seguridad, debes haber iniciado sesión recientemente para eliminar tu cuenta. Por favor, cierra sesión e inicia sesión de nuevo.");
      } else {
        setError("No se pudo eliminar la cuenta. Inténtalo de nuevo.");
      }
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setLoading(true);
    setSuccess(false);
    setError(null);
    try {
      // Check if username changed
      const newUsername = formData.username.toLowerCase().trim();
      if (newUsername !== profile.username) {
        const usernameRegex = /^[a-zA-Z0-9._-]+$/;
        if (!usernameRegex.test(newUsername)) {
          throw new Error('El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos.');
        }
        if (newUsername.length < 3 || newUsername.length > 30) {
          throw new Error('El nombre de usuario debe tener entre 3 y 30 caracteres.');
        }

        const uQuery = query(collection(db, 'users'), where('username', '==', newUsername));
        const uSnapshot = await getDocs(uQuery);
        if (!uSnapshot.empty) {
          throw new Error('El nombre de usuario ya está en uso. Por favor, elige otro.');
        }
      }

      // Update public profile
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          username: newUsername,
          displayName: formData.displayName,
          bio: formData.bio,
          isPrivate: formData.isPrivate,
          photoURL: formData.photoURL,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }

      // Update private settings
      try {
        await updateDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          birthDate: formData.birthDate
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/private/settings`);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (formattedErr: any) {
      setError("Error al guardar los cambios. Verifica tu conexión o permisos.");
      console.error("Formatted Firestore Error:", formattedErr.message);
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      id: 'profile',
      title: 'Información Personal',
      icon: User,
      fields: [
        { id: 'username', label: 'Nombre de usuario', type: 'text', placeholder: 'usuario123', icon: AtSign },
        { id: 'displayName', label: 'Nombre público', type: 'text', placeholder: 'Tu nombre visible', icon: User },
        { id: 'firstName', label: 'Nombre', type: 'text', placeholder: 'Tu nombre real', icon: User },
        { id: 'lastName', label: 'Apellidos', type: 'text', placeholder: 'Tus apellidos', icon: User },
        { id: 'birthDate', label: 'Fecha de nacimiento', type: 'date', icon: Calendar },
      ]
    },
    {
      id: 'bio',
      title: 'Biografía',
      icon: AtSign,
      fields: [
        { id: 'bio', label: 'Sobre ti', type: 'textarea', placeholder: 'Cuéntanos algo sobre ti...', icon: AtSign },
      ]
    }
  ];

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
          <h1 className="text-xl font-bold text-white">Configuración</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading || uploading}
          className="px-6 py-2 bg-gold text-black rounded-xl font-bold text-sm hover:bg-gold-light transition-all disabled:opacity-50 flex items-center space-x-2"
        >
          {success ? (
            <>
              <Check size={16} />
              <span>Guardado</span>
            </>
          ) : (
            <span>{loading ? 'Guardando...' : 'Guardar'}</span>
          )}
        </button>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-8">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-sm font-medium text-center"
          >
            {error}
          </motion.div>
        )}
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black-soft border border-rose-500/20 p-8 rounded-3xl max-w-sm w-full text-center space-y-6 shadow-2xl shadow-rose-500/10"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Shield size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">¿Eliminar cuenta?</h2>
                <p className="text-gold/40 text-sm">Esta acción es irreversible. Se borrarán todos tus datos y perderás el acceso.</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all disabled:opacity-50"
                >
                  {deleteLoading ? 'Eliminando...' : 'Sí, eliminar cuenta'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                  className="w-full py-4 bg-black border border-gold/20 text-gold rounded-2xl font-bold hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Profile Picture Preview */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            <div className="p-1 rounded-full bg-gradient-to-tr from-gold-dark via-gold to-gold-light">
              <img 
                src={previewUrl || formData.photoURL || 'https://via.placeholder.com/150'} 
                alt="Preview" 
                className="w-24 h-24 lg:w-32 lg:h-32 rounded-full object-cover border-4 border-black shadow-2xl"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${formData.displayName || 'User'}&background=random`;
                }}
              />
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-gold text-black rounded-full shadow-lg cursor-pointer hover:bg-gold-light transition-all">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <p className="text-gold/40 text-xs uppercase tracking-widest font-bold">Toca la cámara para cambiar tu foto</p>
            {formData.photoURL && (
              <button 
                onClick={() => setFormData(prev => ({ ...prev, photoURL: '' }))}
                className="text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:underline"
              >
                Eliminar foto
              </button>
            )}
          </div>
        </div>

        {/* Privacy Toggle */}
        <section className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                {formData.isPrivate ? <Lock size={24} /> : <Shield size={24} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Cuenta Privada</h2>
                <p className="text-gold/40 text-sm">Solo tus seguidores podrán ver tu contenido.</p>
              </div>
            </div>
            <button 
              onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
              className={`w-14 h-8 rounded-full transition-all relative ${formData.isPrivate ? 'bg-gold' : 'bg-slate-800'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.isPrivate ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </section>

        {/* Cloud Services */}
        <section className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl">
          <button 
            onClick={() => navigate('/clouds')}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Cloud size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Mis Nubes</h2>
                <p className="text-gold/40 text-sm">Gestiona Google Photos, iCloud y más.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {googlePhotosConnected && <Check size={16} className="text-green-500" />}
              <ChevronRight size={24} className="text-gold/40 group-hover:text-gold transition-colors" />
            </div>
          </button>
        </section>

        {/* Form Sections */}
        {sections.map((section) => (
          <section key={section.id} className="space-y-4">
            <div className="flex items-center space-x-2 px-2">
              <section.icon size={18} className="text-gold" />
              <h2 className="text-sm font-bold text-gold uppercase tracking-widest">{section.title}</h2>
            </div>
            
            <div className="bg-black-soft rounded-3xl border border-gold/20 shadow-xl overflow-hidden divide-y divide-gold/10">
              {section.fields.map((field) => (
                <div key={field.id} className="p-4 lg:p-6 space-y-2">
                  <label className="block text-xs font-bold text-gold/60 uppercase tracking-wider ml-1">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.id as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full bg-black/40 border border-gold/10 rounded-2xl px-4 py-3 text-white focus:ring-1 focus:ring-gold outline-none h-32 resize-none text-sm lg:text-base"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type={field.type}
                        value={formData[field.id as keyof typeof formData] as string}
                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full bg-black/40 border border-gold/10 rounded-2xl px-4 py-3 text-white focus:ring-1 focus:ring-gold outline-none text-sm lg:text-base"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Email (Read Only for now) */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 px-2">
            <Mail size={18} className="text-gold" />
            <h2 className="text-sm font-bold text-gold uppercase tracking-widest">Cuenta</h2>
          </div>
          <div className="bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl">
            <div className="flex items-center justify-between opacity-60">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gold/60 uppercase tracking-wider">Correo electrónico</p>
                <p className="text-white font-medium">{profile?.email}</p>
              </div>
              <Lock size={18} className="text-gold/40" />
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 px-2">
            <Clock size={18} className="text-gold" />
            <h2 className="text-sm font-bold text-gold uppercase tracking-widest">Preferencias</h2>
          </div>
          <button 
            onClick={() => navigate('/wellbeing')}
            className="w-full bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl flex items-center justify-between group hover:bg-gold/5 transition-all mb-4"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Bienestar Digital</h2>
                <p className="text-gold/40 text-sm">Gestiona tus límites de tiempo.</p>
              </div>
            </div>
            <ChevronRight size={24} className="text-gold/40 group-hover:text-gold transition-colors" />
          </button>
        </section>

        {/* System / Admin */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 px-2">
            <Shield size={18} className="text-gold" />
            <h2 className="text-sm font-bold text-gold uppercase tracking-widest">Sistema</h2>
          </div>
          <button 
            onClick={() => navigate('/test-integrity')}
            className="w-full bg-black-soft p-6 rounded-3xl border border-gold/20 shadow-xl flex items-center justify-between group hover:bg-gold/5 transition-all"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
                <Database size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Integridad de Datos</h2>
                <p className="text-gold/40 text-sm">Comprobar salud de la base de datos.</p>
              </div>
            </div>
            <ChevronRight size={24} className="text-gold/40 group-hover:text-gold transition-colors" />
          </button>
        </section>

        {/* Danger Zone */}
        <section className="pt-8 space-y-4">
          <button 
            onClick={signOut}
            className="w-full py-4 bg-black-soft text-gold rounded-2xl font-bold border border-gold/20 hover:bg-gold/10 transition-all flex items-center justify-center space-x-2"
          >
            <LogOut size={20} />
            <span>Cerrar sesión</span>
          </button>
          
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-bold border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
          >
            Eliminar cuenta
          </button>
          <p className="text-center text-gold/20 text-[10px] mt-4 uppercase tracking-widest">
            Original v1.0.0 • Hecho con amor
          </p>
        </section>
      </div>
    </div>
  );
};
