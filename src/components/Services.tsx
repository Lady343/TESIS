import { Truck, Package, Layers, Trash2, ArrowLeftRight } from 'lucide-react';

export default function Services() {
  const services = [
    {
      icon: <Truck className="h-12 w-12 text-red-600" />,
      title: 'Transporte de carga pesada en volquetas',
      description: 'Traslado seguro de materiales de construcción como arena, grava, piedra y tierra para obras civiles y proyectos de infraestructura.'
    },
    {
      icon: <Layers className="h-12 w-12 text-red-600" />,
      title: 'Transporte de materiales de ripios de perforación',
      description: 'Servicio especializado en la movilización de ripios y residuos de perforación generados en trabajos de construcción y excavación, con manejo responsable.'
    },
    {
      icon: <Trash2 className="h-12 w-12 text-red-600" />,
      title: 'Servicios de desalojo',
      description: 'Retiro y transporte de escombros y material sobrante de obras, contribuyendo al orden y limpieza en los frentes de trabajo.'
    },
    {
      icon: <Package className="h-12 w-12 text-red-600" />,
      title: 'Transporte de carga seca',
      description: 'Distribución de cemento, bloques, varillas, tuberías e insumos de construcción en rutas locales y nacionales.'
    },
    {
      icon: <ArrowLeftRight className="h-12 w-12 text-red-600" />,
      title: 'Trasteos de materiales',
      description: 'Movilización eficiente de herramientas, equipos y materiales entre obras, bodegas y puntos de entrega.'
    }
  ];

  return (
    <section id="servicios" className="py-20 bg-gray-50 scroll-mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nuestros Servicios
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Soluciones integrales de transporte para la construcción, minería y proyectos de infraestructura.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-1"
            >
              <div className="mb-6">{service.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{service.title}</h3>
              <p className="text-gray-600 leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
