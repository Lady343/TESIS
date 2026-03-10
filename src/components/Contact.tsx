import { useState, FormEvent } from 'react';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    servicio: '',
    mensaje: ''
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const destEmail = 'centralshushufindi@hotmail.com';
    const subject = `Nueva Solicitud de Cotización - ${formData.nombre}`;
    
    // Construct the email body
    const body = `
Hola Cooperativa Central Shushufindi,

He enviado una solicitud de cotización desde la página web. Aquí están mis detalles:

Nombre Completo: ${formData.nombre}
Email: ${formData.email}
Teléfono: ${formData.telefono}
Tipo de Servicio de Interés: ${formData.servicio || 'No especificado'}

Mensaje:
${formData.mensaje}

Saludos,
${formData.nombre}
    `.trim();

    // Abrir Gmail directamente en el navegador (evita que Windows abra Outlook)
    const gmailLink = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(destEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(gmailLink, '_blank');
  };

  return (
    <section id="contacto" className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white scroll-mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Contáctanos
          </h2>
          <p className="text-lg text-gray-300">
            Estamos listos para atender tus necesidades de transporte
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column: Info & Map */}
          <div className="space-y-8">
            {/* Contact Info List */}
            <div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-gray-200 font-medium">Via aguarico 3 N412 y Atahualpa</p>
                    <p className="text-gray-400 text-sm">Shushufindi, Sucumbíos, Ecuador</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Mail className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-gray-200">centralshushufindi@hotmail.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Phone className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-gray-200">+593 6 212-1459</p>
                    <p className="text-gray-400 text-sm">+593 99 241-1304</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-gray-200">Lun - Vie: 8:00 - 17:00</p>

                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-white/20 h-[300px] w-full relative group">
              <iframe
                src="https://maps.google.com/maps?q=Coop+Volquetas+Central+SSFD&hl=es&z=17&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="filter grayscale-[10%] group-hover:grayscale-0 transition-all duration-700"
              ></iframe>
            </div>
          </div>

          {/* Right Column: Compact Form */}
          <div className="bg-white/5 backdrop-blur-sm p-6 md:p-8 rounded-xl border border-white/10">
            <h3 className="text-xl font-bold mb-6 text-center">Solicita una Cotización</h3>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  placeholder="Tu nombre"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-300">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                    placeholder="tucorreo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-300">Teléfono</label>
                  <input
                    type="tel"
                    required
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                    placeholder="099..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Tipo de Servicio</label>
                <select 
                  required
                  value={formData.servicio}
                  onChange={(e) => setFormData({...formData, servicio: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                >
                  <option value="" className="bg-gray-900">Seleccionar servicio</option>
                  <option value="Transporte de carga pesada en volquetas" className="bg-gray-900">Transporte de carga pesada en volquetas</option>
                  <option value="Transporte de materiales de ripios de perforación" className="bg-gray-900">Transporte de materiales de ripios de perforación</option>
                  <option value="Servicios de desalojo" className="bg-gray-900">Servicios de desalojo</option>
                  <option value="Trasteos de materiales" className="bg-gray-900">Trasteos de materiales</option>
                  <option value="Transporte de carga seca" className="bg-gray-900">Transporte de carga seca</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-300">Mensaje</label>
                <textarea
                  required
                  rows={3}
                  value={formData.mensaje}
                  onChange={(e) => setFormData({...formData, mensaje: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  placeholder="Detalles de tu carga o consulta..."
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-all font-bold shadow-lg hover:shadow-xl text-sm mt-2"
              >
                Enviar Solicitud
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
