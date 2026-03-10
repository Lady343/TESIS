export default function Materials() {
    const materials = [
        { name: 'Lastre grueso y fino', image: '/Materials/lastre.png' },
        { name: 'Arena', image: '/Materials/arena.png' },
        { name: 'Zarandeado de 2, 3, 4', image: '/Materials/zarandeado_numeros.jpg' },
        { name: 'Zarandeado para hormigón', image: '/Materials/zarandeado_hormigon.png' },
        { name: 'Piedra bola', image: '/Materials/piedra_bola.png' },
        { name: 'Triturado', image: '/Materials/triturado.png' },
        { name: 'Arena de Hormigón', image: '/Materials/arena_hormigon.png' },
        { name: 'Arcilla', image: '/Materials/arcilla.png' },
        { name: 'Sub Base III', image: '/Materials/sub_base.jpg' },
    ];

    return (
        <section id="materiales" className="py-20 bg-gray-50 scroll-mt-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        Nuestros materiales
                    </h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        Suministramos y transportamos materiales de alta calidad para todo tipo de obras civiles y proyectos de infraestructura.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
                    {materials.map((material, index) => (
                        <div
                            key={index}
                            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
                        >
                            <img
                                src={material.image}
                                alt={material.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800&text=${encodeURIComponent(material.name)}`;
                                }}
                            />
                            {/* Gradient overlay with name */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h3 className="text-white font-bold text-lg md:text-xl drop-shadow-lg">
                                    {material.name}
                                </h3>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
