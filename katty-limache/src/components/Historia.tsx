import FotoReal from "./FotoReal";

export default function Historia() {
  return (
    <section id="historia" className="scroll-mt-20 bg-charcoal/[0.03] py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
        <FotoReal
          src="historia-diario.jpg"
          label="Recorte del diario La Estrella de Quillota (31 dic 2021) sobre Katty"
          className="w-full aspect-[3/4] sm:aspect-[4/3] object-cover rounded-3xl"
        />

        <div>
          <h2 className="font-heading font-semibold text-section text-charcoal mb-5">
            Nuestra historia
          </h2>
          <div className="flex flex-col gap-4 font-body text-charcoal/80">
            <p>
              Todo comenzó con Katherine González, que partió vendiendo 30
              empanadas hechas en casa en Limache. Con dedicación y el cariño
              de los vecinos del sector, esa idea pequeña se fue transformando
              en un proyecto familiar cada vez más grande.
            </p>
            <p>
              Hoy Empanadas Katty tiene 3 locales y una carta de 16 variedades,
              manteniendo siempre la receta y el sabor casero de los primeros
              días.
            </p>
            <p>
              Detrás de cada empanada hay un equipo compuesto en su mayoría por
              mujeres de la zona, que día a día siguen cocinando con la misma
              dedicación con la que empezó todo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
