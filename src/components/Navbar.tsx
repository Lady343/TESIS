import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  onLoginClick: () => void;
}

export default function Navbar({ onLoginClick }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-28">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img
              src="/LOGO_PESADA.png"
              alt="Logo Cooperativa Central Shushufindi"
              className="h-12 w-12 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 leading-tight">
                COOPERATIVA CENTRAL SHUSHUFINDI
              </span>
              <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-600 font-medium leading-tight sm:whitespace-nowrap">
                Transporte de Carga Pesada Nacional e Internacional
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#inicio" className="text-gray-700 hover:text-red-600 transition-colors font-medium">Inicio</a>
            <a href="#servicios" className="text-gray-700 hover:text-red-600 transition-colors font-medium">Servicios</a>
            <a href="#materiales" className="text-gray-700 hover:text-red-600 transition-colors font-medium">Materiales</a>
            <a href="#flota" className="text-gray-700 hover:text-red-600 transition-colors font-medium">Flota</a>
            <a href="#nosotros" className="text-gray-700 hover:text-red-600 transition-colors font-medium">Nosotros</a>
            <a href="#contacto" className="text-gray-700 hover:text-red-600 transition-colors font-medium">Contacto</a>
            <button
              onClick={onLoginClick}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Iniciar Sesión
            </button>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-700">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 pt-4 pb-4 space-y-3">
            <a href="#inicio" className="block text-gray-700 hover:text-red-600 transition-colors font-medium">Inicio</a>
            <a href="#servicios" className="block text-gray-700 hover:text-red-600 transition-colors font-medium">Servicios</a>
            <a href="#materiales" className="block text-gray-700 hover:text-red-600 transition-colors font-medium">Materiales</a>
            <a href="#flota" className="block text-gray-700 hover:text-red-600 transition-colors font-medium">Flota</a>
            <a href="#nosotros" className="block text-gray-700 hover:text-red-600 transition-colors font-medium">Nosotros</a>
            <a href="#contacto" className="block text-gray-700 hover:text-red-600 transition-colors font-medium">Contacto</a>
            <button
              onClick={onLoginClick}
              className="w-full bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
