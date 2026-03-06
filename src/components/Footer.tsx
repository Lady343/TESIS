import { Facebook, Instagram, Linkedin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="sm:col-span-2">
            <div className="flex items-center space-x-4 mb-8">
              <img
                src="/LOGO_PESADA.png"
                alt="Logo Cooperativa Central Shushufindi"
                className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 object-contain"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white leading-tight">
                  COOPERATIVA CENTRAL SHUSHUFINDI
                </span>

                <span className="text-sm text-gray-400">
                  Transporte de Carga Pesada Nacional e Internacional
                </span>
              </div>
            </div>


          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Enlaces Rápidos</h3>
            <ul className="space-y-2">
              <li><a href="#inicio" className="text-gray-400 hover:text-red-500 transition-colors">Inicio</a></li>
              <li><a href="#servicios" className="text-gray-400 hover:text-red-500 transition-colors">Servicios</a></li>
              <li><a href="#flota" className="text-gray-400 hover:text-red-500 transition-colors">Flota</a></li>
              <li><a href="#nosotros" className="text-gray-400 hover:text-red-500 transition-colors">Nosotros</a></li>
              <li><a href="#contacto" className="text-gray-400 hover:text-red-500 transition-colors">Contacto</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Síguenos</h3>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/profile.php?id=100067060135380" target="_blank" rel="noopener noreferrer" className="bg-white/10 p-3 rounded-lg hover:bg-red-600 transition-all">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="bg-white/10 p-3 rounded-lg hover:bg-red-600 transition-all">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="bg-white/10 p-3 rounded-lg hover:bg-red-600 transition-all">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 Cooperativa de Transporte de Carga Pesada Nacional e Internacional Central Shushufindi. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
