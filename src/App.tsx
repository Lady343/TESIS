import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import Materials from './components/Materials';
import Fleet from './components/Fleet';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import UpdatePasswordModal from './components/UpdatePasswordModal';
import Sistema from './sistema/Sistema';
import { useUser } from './sistema/UserContext';

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const { session, loading, user, logout } = useUser();

  useEffect(() => {
    // Escuchar el evento de recuperación de contraseña de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  // Si hay sesión activa y no está en proceso de recuperación, mostrar el sistema de gestión
  if (session && user && !isRecovering) {
    return (
      <Sistema
        userEmail={user.email || ''}
        onLogout={logout}
      />
    );
  }

  // Sitio público
  return (
    <div className="min-h-screen">
      <Navbar onLoginClick={() => setIsLoginOpen(true)} />
      <Hero />
      <Services />
      <Materials />
      <Fleet />
      <About />
      <Contact />
      <Footer />
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
      <UpdatePasswordModal 
        isOpen={isRecovering}
        onClose={() => setIsRecovering(false)}
      />
    </div>
  );
}

export default App;
