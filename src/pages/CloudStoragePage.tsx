import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { 
  Cloud, 
  ArrowLeft, 
  Check, 
  X, 
  Smartphone, 
  ExternalLink,
  Info,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CloudStoragePage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [googlePhotosConnected, setGooglePhotosConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const storedTokens = localStorage.getItem('google_photos_tokens');
    if (storedTokens) setGooglePhotosConnected(true);

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
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGooglePhotos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_photos_auth', 'width=600,height=700');
    } catch (err) {
      console.error("Error connecting to Google Photos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGooglePhotos = () => {
    localStorage.removeItem('google_photos_tokens');
    setGooglePhotosConnected(false);
  };

  const cloudServices = [
    {
      id: 'google-photos',
      name: 'Google Photos',
      description: 'Accede directamente a tu biblioteca de Google Photos desde OG.',
      icon: Cloud,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      connected: googlePhotosConnected,
      onConnect: handleConnectGooglePhotos,
      onDisconnect: handleDisconnectGooglePhotos,
      type: 'api'
    },
    {
      id: 'icloud',
      name: 'iCloud Drive',
      description: 'Integrado automáticamente a través del selector de archivos de tu iPhone.',
      icon: Smartphone,
      color: 'text-sky-400',
      bgColor: 'bg-sky-400/10',
      connected: true,
      type: 'native'
    },
    {
      id: 'onedrive',
      name: 'OneDrive / Dropbox',
      description: 'Disponible si tienes las aplicaciones instaladas en tu dispositivo.',
      icon: ExternalLink,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-400/10',
      connected: true,
      type: 'native'
    }
  ];

  return (
    <div className="min-h-screen bg-black pb-24 lg:pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 pt-safe glass border-b border-gold/20 px-4 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 text-gold/60 hover:text-gold transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Mis Nubes</h1>
        </div>
        <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center text-gold">
          <Cloud size={20} />
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-8">
        <div className="bg-gold/5 border border-gold/20 p-6 rounded-3xl space-y-4">
          <div className="flex items-center space-x-3 text-gold">
            <Info size={24} />
            <h2 className="text-lg font-bold uppercase tracking-tight">Almacenamiento Inteligente</h2>
          </div>
          <p className="text-gold/60 text-sm leading-relaxed">
            En **OG** no necesitas pagar por almacenamiento extra. Nos conectamos directamente con tus servicios de nube favoritos para que tus archivos estén siempre seguros y accesibles.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gold/40 uppercase tracking-[0.2em] px-2">Servicios Disponibles</h3>
          
          <div className="grid gap-4">
            {cloudServices.map((service) => (
              <motion.div 
                key={service.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black-soft p-6 rounded-3xl border border-gold/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 ${service.bgColor} ${service.color} rounded-2xl flex items-center justify-center shrink-0`}>
                    <service.icon size={28} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>{service.name}</span>
                      {service.connected && <Check size={16} className="text-green-500" />}
                    </h4>
                    <p className="text-gold/40 text-sm">{service.description}</p>
                  </div>
                </div>

                {service.type === 'api' ? (
                  service.connected ? (
                    <button 
                      onClick={service.onDisconnect}
                      className="px-6 py-3 bg-rose-500/10 text-rose-500 rounded-2xl text-sm font-bold hover:bg-rose-500/20 transition-all border border-rose-500/20"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button 
                      onClick={service.onConnect}
                      disabled={loading}
                      className="px-6 py-3 bg-gold text-black rounded-2xl text-sm font-bold hover:bg-gold-light transition-all shadow-lg shadow-gold/10 flex items-center justify-center space-x-2"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                      <span>Conectar</span>
                    </button>
                  )
                ) : (
                  <div className="px-6 py-3 bg-white/5 text-gold/40 rounded-2xl text-xs font-bold uppercase tracking-widest border border-white/5">
                    Activo por defecto
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="pt-8 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-white">¿Cómo funciona?</h3>
            <p className="text-gold/40 text-sm">Al crear una publicación, verás estas opciones:</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black-soft p-6 rounded-3xl border border-gold/10 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-full flex items-center justify-center">
                <ImageIcon size={24} />
              </div>
              <div>
                <h4 className="font-bold text-white">Selector Nativo</h4>
                <p className="text-gold/40 text-xs">Usa el selector de tu iPhone para elegir archivos de iCloud, Drive o OneDrive.</p>
              </div>
            </div>
            <div className="bg-black-soft p-6 rounded-3xl border border-gold/10 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-gold/10 text-gold rounded-full flex items-center justify-center">
                <Cloud size={24} />
              </div>
              <div>
                <h4 className="font-bold text-white">Google Photos</h4>
                <p className="text-gold/40 text-xs">Si está conectado, podrás navegar por tu biblioteca de Google directamente.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-8">
          <p className="text-gold/20 text-[10px] uppercase tracking-[0.3em]">
            Tus datos están protegidos por cifrado de extremo a extremo
          </p>
        </div>
      </div>
    </div>
  );
};
