import { TrendingUp, CheckCircle, Target, Eye } from 'lucide-react';

export default function About() {
  const values = [
    {
      title: 'Honestidad',
      description: 'Creemos en la honestidad en nuestras acciones y relaciones con los colaboradores, y en la transmisión de información de la institución a nuestros socios en forma veraz, clara y oportuna.'
    },
    {
      title: 'Ética',
      description: 'Consideramos que el compromiso personal de actuar en base a principios éticos es una característica que distingue al personal de la Cooperativa y genera un clima de respeto y confianza entre los colaboradores.'
    },
    {
      title: 'Responsabilidad Social y Cuidado del Medio Ambiente',
      description: 'La Responsabilidad Social es un pilar de nuestra cooperativa, enfocado en el bienestar social y el cuidado del medio ambiente.'
    },
    {
      title: 'Respeto',
      description: 'Consideramos que el respeto es un valor fundamental en nuestras relaciones internas y externas.'
    }
  ];

  return (
    <section id="nosotros" className="py-20 bg-white scroll-mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Sobre Nosotros
          </h2>
          <div className="space-y-6 max-w-4xl mx-auto">
            <p className="text-lg text-gray-600 leading-relaxed">
              Ofrecemos transporte de carga pesada con experiencia, seguridad y compromiso en cada servicio.
            </p>

          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Target className="h-8 w-8 text-red-600" />
              <h3 className="text-2xl font-bold text-gray-900">Misión</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Velar por el bien común de cada una de nuestras Filiales dedicadas a la industria del transporte de carga pesada por carretera, misma que es fundamental y estratégica para el desarrollo del país, proporcionándoles información veraz de los temas relacionados a la actividad, sustentando técnica y legalmente los procesos inherentes a su desarrollo y contribuir al bienestar de sus integrantes.
            </p>
          </div>
          <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="h-8 w-8 text-red-600" />
              <h3 className="text-2xl font-bold text-gray-900">Visión</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Ser una organización gremial líder en el ámbito de la transportación de carga pesada de la provincia de Sucumbíos, ofreciendo servicios integrales y de calidad a cada una de nuestras empresas filiales.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-2xl border border-gray-100 shadow-md">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="h-8 w-8 text-red-600" />
            <h3 className="text-3xl font-bold text-gray-900">Nuestros Valores</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="bg-red-50 p-2 rounded-lg flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{value.title}</h4>
                  <p className="text-gray-600 leading-relaxed text-justify">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
