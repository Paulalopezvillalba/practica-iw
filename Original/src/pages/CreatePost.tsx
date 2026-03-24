import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Image, Video, X, Send, Clock, Upload, Loader2, Play, Cloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CreatePost: React.FC = () => {
  const { user, profile } = useAuth();
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<'24h' | '7d' | '30d' | 'permanent'>('permanent');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGooglePhotos, setShowGooglePhotos] = useState(false);
  const [googlePhotos, setGooglePhotos] = useState<any[]>([]);
  const [fetchingPhotos, setFetchingPhotos] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file || !user) return;

    // Local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    
    setUploading(true);
    setError(null);
    try {
      const isVideo = file.type.startsWith('video/');
      const type = isVideo ? 'video' : 'image';
      setMediaType(type);

      const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setMediaUrl(url);
    } catch (err: any) {
      console.error("Error uploading file:", err);
      if (err.code === 'storage/unauthorized' || err.code === 'storage/retry-limit-exceeded') {
        setError("Error de permisos: Asegúrate de haber activado Firebase Storage en la consola de Firebase.");
      } else {
        setError("Error al subir el archivo. Verifica que Firebase Storage esté activado.");
      }
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const fetchGooglePhotos = async () => {
    const tokensStr = localStorage.getItem('google_photos_tokens');
    if (!tokensStr) {
      setError("Conecta Google Photos en Configuración primero.");
      return;
    }
    const tokens = JSON.parse(tokensStr);
    setFetchingPhotos(true);
    setShowGooglePhotos(true);
    try {
      const response = await fetch('/api/google-photos/list', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const data = await response.json();
      setGooglePhotos(data.mediaItems || []);
    } catch (err) {
      console.error("Error fetching Google Photos:", err);
      setError("No se pudieron cargar tus fotos de Google.");
    } finally {
      setFetchingPhotos(false);
    }
  };

  const handleSelectGooglePhoto = (photo: any) => {
    setMediaUrl(photo.baseUrl + "=w1080-h1080"); // High res version
    setPreviewUrl(photo.baseUrl + "=w1080-h1080");
    setMediaType(photo.mimeType?.startsWith('video/') ? 'video' : 'image');
    setShowGooglePhotos(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mediaUrl) return;

    setLoading(true);
    setError(null);
    try {
      // Extract hashtags
      const hashtags = description.match(/#[a-z0-9_]+/gi) || [];

      // Calculate expiry
      let expiresAt = null;
      if (duration !== 'permanent') {
        const now = new Date();
        if (duration === '24h') now.setHours(now.getHours() + 24);
        if (duration === '7d') now.setDate(now.getDate() + 7);
        if (duration === '30d') now.setDate(now.getDate() + 30);
        expiresAt = now.toISOString();
      }

      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: profile?.username || user.displayName,
        authorPhoto: profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.username || user.displayName}&background=random`,
        mediaUrl,
        mediaType,
        description,
        hashtags,
        duration,
        expiresAt,
        likesCount: 0,
        commentsCount: 0,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      navigate('/');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'posts');
      } catch (formattedErr: any) {
        setError("Error al crear la publicación. Verifica tu conexión.");
        console.error("Formatted Firestore Error:", formattedErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto bg-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-black-soft rounded-3xl shadow-2xl border border-gold/20 overflow-hidden"
      >
        <div className="p-6 border-b border-gold/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gold">Nueva publicación</h2>
          <button onClick={() => navigate(-1)} className="text-gold/40 hover:text-gold transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-sm font-medium text-center">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gold/80">Contenido multimedia</label>
            
            {!mediaUrl && !previewUrl ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center space-y-4 cursor-pointer transition-all group ${
                  isDragging 
                    ? 'border-gold bg-gold/10 scale-[1.02]' 
                    : 'border-gold/20 hover:border-gold/40 hover:bg-gold/5'
                }`}
              >
                <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  {uploading ? <Loader2 size={32} className="animate-spin" /> : <Upload size={32} />}
                </div>
                <div className="text-center">
                  <p className="text-white font-bold">{uploading ? 'Subiendo contenido...' : 'Haz clic o arrastra aquí'}</p>
                  <p className="text-gold/40 text-sm">Imagen o Vídeo (PNG, JPG, MP4...)</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*,video/*"
                  onChange={onFileChange}
                  disabled={uploading}
                />
              </div>
            ) : (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-gold/10">
                {uploading && (
                  <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-2">
                    <Loader2 size={32} className="text-gold animate-spin" />
                    <p className="text-gold text-xs font-bold uppercase tracking-widest">Subiendo...</p>
                  </div>
                )}
                {mediaType === 'image' ? (
                  <img 
                    src={previewUrl || mediaUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/800x450?text=Error+al+cargar+imagen';
                    }}
                  />
                ) : (
                  <video src={previewUrl || mediaUrl} className="w-full h-full object-cover" controls />
                )}
                <button 
                  type="button"
                  onClick={() => {
                    setMediaUrl('');
                    setPreviewUrl(null);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black transition-colors backdrop-blur-md z-20"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <div className="flex-1 h-px bg-gold/10" />
              <span className="text-[10px] font-bold text-gold/20 uppercase tracking-widest">O usa una URL</span>
              <div className="flex-1 h-px bg-gold/10" />
            </div>

            <div className="flex space-x-2">
              <input 
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-black border border-gold/20 text-white focus:ring-2 focus:ring-gold outline-none placeholder:text-slate-600 text-sm"
                placeholder="https://ejemplo.com/media.jpg"
              />
              <select 
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as any)}
                className="px-4 py-3 rounded-xl border border-gold/20 bg-black font-medium text-gold/80 outline-none text-sm"
              >
                <option value="image">Imagen</option>
                <option value="video">Vídeo</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gold/80">Descripción y hashtags</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black border border-gold/20 text-white focus:ring-2 focus:ring-gold outline-none h-32 resize-none placeholder:text-slate-600"
              placeholder="Escribe algo inspirador... #bienestar #original"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gold/80 flex items-center space-x-2">
              <Clock size={16} className="text-gold" />
              <span>Duración de la publicación</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['24h', '7d', '30d', 'permanent'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d as any)}
                  className={`py-2 rounded-lg text-sm font-bold border transition-all ${
                    duration === d 
                      ? 'bg-gold border-gold text-black shadow-md' 
                      : 'bg-black border-gold/20 text-gold/40 hover:border-gold/60'
                  }`}
                >
                  {d === 'permanent' ? 'Infinita' : d}
                </button>
              ))}
            </div>
            <p className="text-xs text-gold/40 mt-1 italic">
              Las publicaciones temporales se archivarán automáticamente al expirar.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !mediaUrl}
            className="w-full py-4 bg-gold text-black rounded-2xl font-bold text-lg hover:bg-gold-light transition-all shadow-lg shadow-gold/20 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? 'Publicando...' : (
              <>
                <Send size={20} />
                <span>Compartir</span>
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Google Photos Modal */}
      {showGooglePhotos && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black-soft border border-gold/20 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-gold/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Cloud className="text-gold" />
                <h3 className="text-xl font-bold text-gold">Tus Google Photos</h3>
              </div>
              <button onClick={() => setShowGooglePhotos(false)} className="text-gold/40 hover:text-gold">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {fetchingPhotos ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 size={48} className="text-gold animate-spin" />
                  <p className="text-gold/60">Cargando tu biblioteca...</p>
                </div>
              ) : googlePhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {googlePhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleSelectGooglePhoto(photo)}
                      className="aspect-square rounded-2xl overflow-hidden border border-gold/10 hover:border-gold transition-all group relative"
                    >
                      <img 
                        src={photo.baseUrl + "=w300-h300-c"} 
                        alt={photo.filename}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      {photo.mimeType?.startsWith('video/') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play size={24} className="text-white fill-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-gold/40">No se encontraron fotos en tu biblioteca.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
