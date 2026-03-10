import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Fleet() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  const itemsPerView = 3;

  const trucks = [
    {
      type: 'Volquetas Hino',
      description: 'Gran flota de 24 unidades robustas y confiables, ideales para el transporte masivo de materiales de construcción y carga pesada en proyectos.',
      image: '/Fleet/hino.png',
    },
    {
      type: 'Volquetas Chevrolet',
      description: 'Disponemos de 2 unidades de alto rendimiento, perfectas para operaciones exigentes y transporte eficiente de materiales en obra.',
      image: '/chevrolet1.jpeg',
    },
    {
      type: 'Cabezales Plataforma Cama Alta',
      description: 'Contamos con 2 unidades especializadas para el traslado seguro de maquinaria pesada y equipos sobredimensionados.',
      image: '/Fleet/cabezal_plataforma_cama_alta.png',
    },
    {
      type: 'Cabezal Auto Tanque',
      description: 'Unidad equipada para el transporte seguro de líquidos y abastecimiento en proyectos, cumpliendo con los estándares de seguridad.',
      image: '/Fleet/cabezal_auto_tanque.png',
    },
    {
      type: 'Excavadora 250 Hyundai',
      description: 'Maquinaria potente para excavación, movimiento de tierras y demolición, garantizando precisión y rapidez en el trabajo.',
      image: '/Fleet/excavadora_250_hyundai.png',
    },
    {
      type: 'Excavadora 330 Hyundai',
      description: 'Equipo de gran capacidad para excavaciones profundas y movimiento de grandes volúmenes de tierra en proyectos de infraestructura.',
      image: '/Fleet/excavadora_330_hyundai.png',
    },
    {
      type: 'Cargadora Doosan',
      description: 'Cargadora frontal versátil y ágil, esencial para la manipulación y carga de materiales como arena, grava y tierra.',
      image: '/Fleet/cargadora_doosan.png',
    },
    {
      type: 'Cargadora SEM 659',
      description: 'Equipo robusto para trabajos de carga pesada, ofreciendo eficiencia en canteras y plantas de procesamiento.',
      image: '/Fleet/cargadora_sem.png',
    },
    {
      type: 'Motoniveladora',
      description: 'Especializada en la nivelación y perfilado de terrenos, esencial para la construcción y mantenimiento de vías.',
      image: '/Fleet/motoniveladora.png',
    },
    {
      type: 'Trituradora de Piedra',
      description: 'Equipo industrial para la trituración y procesamiento de áridos, produciendo material de construcción de alta calidad en sitio.',
      image: '/Fleet/trituradora_piedra.png',
    },
  ];

  // Extend key trucks to allow seamless looping
  const extendedTrucks = [...trucks, ...trucks.slice(0, itemsPerView)];

  const next = () => {
    if (currentIndex >= trucks.length) return;
    setCurrentIndex((prev) => prev + 1);
  };

  const prev = () => {
    if (currentIndex === 0) {
      setIsTransitioning(false);
      setCurrentIndex(trucks.length);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          setCurrentIndex(trucks.length - 1);
        });
      });
    } else {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  useEffect(() => {
    if (currentIndex === trucks.length) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(0);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, trucks.length]);

  useEffect(() => {
    if (currentIndex === 0 && !isTransitioning) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
      });
    }
  }, [currentIndex, isTransitioning]);


  return (
    <section id="flota" className="py-20 bg-gray-50 scroll-mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nuestra Flota
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Contamos con unidades modernas y en excelente estado para garantizar el transporte seguro de tu carga.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative px-6 md:px-16">
          {/* Navigation Arrows */}
          <button
            onClick={prev}
            className="absolute left-0 md:left-2 top-1/2 -translate-y-1/2 z-20 bg-white w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>

          <button
            onClick={next}
            className="absolute right-0 md:right-2 top-1/2 -translate-y-1/2 z-20 bg-white w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>

          {/* Slides Container */}
          <div className="overflow-hidden rounded-xl">
            <div
              className="flex"
              style={{
                transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
                transition: isTransitioning ? 'transform 500ms ease-in-out' : 'none',
              }}
            >
              {extendedTrucks.map((truck, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 px-4"
                  style={{ width: `${100 / itemsPerView}%` }}
                >
                  <div className="group">
                    <div className="mb-4">
                      <img
                        src={truck.image}
                        alt={truck.type}
                        className="w-full h-auto rounded-lg"
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{truck.type}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3">
                        {truck.description}
                      </p>

                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {trucks.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsTransitioning(true);
                  setCurrentIndex(i);
                }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${(currentIndex % trucks.length) === i ? 'bg-red-600 w-8' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
