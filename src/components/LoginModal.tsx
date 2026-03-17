import { X, User, Lock, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRecovering) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
        if (resetError) throw resetError;
        setSuccessMsg('Se han enviado las instrucciones a tu correo.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        
        onClose(); // Cerrar modal si el login fue exitoso
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <User className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isRecovering ? 'Recuperar Contraseña' : 'Iniciar Sesión'}
            </h2>
            <p className="text-gray-600">
              {isRecovering 
                ? 'Ingresa tu correo para recibir las instrucciones' 
                : 'Accede al sistema de la cooperativa'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg flex items-center gap-2 text-sm">
                <span>{successMsg}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
            </div>

            {!isRecovering && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required={!isRecovering}
                  />
                </div>
                <div className="mt-2 text-right">
                  <button 
                    type="button" 
                    onClick={() => { setIsRecovering(true); setError(''); setSuccessMsg(''); }}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading 
                ? (isRecovering ? 'Enviando...' : 'Iniciando sesión...') 
                : (isRecovering ? 'Enviar Instrucciones' : 'Ingresar al Sistema')}
            </button>
          </form>

          <div className="mt-6 text-center">
            {isRecovering ? (
              <p className="text-sm text-gray-600">
                <button 
                  type="button"
                  onClick={() => { setIsRecovering(false); setError(''); setSuccessMsg(''); }} 
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Volver al inicio de sesión
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                ¿No tienes una cuenta?{' '}
                <a href="#contacto" onClick={onClose} className="text-red-600 hover:text-red-700 font-medium">
                  Contáctanos
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
