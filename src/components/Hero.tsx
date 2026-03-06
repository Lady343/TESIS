import { useState, useEffect } from 'react';

const heroSlides = [
  {
    image: '/cope.png',
    title: 'Sede Central',
    subtitle: 'Infraestructura sólida para operaciones de excelencia'
  },
  {
    image: '/trasteos1.jpeg',
    title: 'Transporte de Materiales',
    subtitle: 'Movilización segura para tus obras y proyectos'
  },
  {
    image: '/chevrolet1.jpeg',
    title: 'Flota de Volquetas',
    subtitle: 'Potencia y capacidad para tus proyectos de construcción'
  }
];

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 8000); // Changed to 5s for better UX testing, 20s is very long
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="inicio"
      className="relative scroll-mt-28 overflow-hidden bg-gray-900"
    >
      {/* Slides Container */}
      <div className="relative w-full h-[500px] md:h-[710px]">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
          >
            {/* Image */}
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover block object-center brightness-110"
            />

            {/* Gradient Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Text content per slide */}
            <div className="absolute inset-0 flex flex-col justify-end items-start z-10 pb-16 sm:pb-24 pl-4 sm:pl-6 md:pl-20 pointer-events-none pr-4">
              <div className="animate-fade-in-up max-w-4xl">
                <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 text-left tracking-tight drop-shadow-lg leading-tight">
                  {slide.title}
                </h1>
                <p className="text-xl md:text-3xl text-gray-100 font-medium text-left drop-shadow-md">
                  {slide.subtitle}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel indicators (dots) */}
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentSlide
                ? 'bg-white w-8'
                : 'bg-white/50 hover:bg-white/80'
                }`}
              aria-label={`Ir a la imagen ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
