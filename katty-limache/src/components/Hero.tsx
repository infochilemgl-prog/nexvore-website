import FotoReal from "./FotoReal";
import BrushDivider from "./BrushDivider";
import { waLink } from "../lib/whatsapp";

export default function Hero() {
  return (
    <section id="inicio" className="relative bg-charcoal text-cream pt-12 pb-28 sm:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-block text-yellow-fluor font-body font-semibold text-sm tracking-wide uppercase mb-4">
            Bienvenidos a Empanadas Katty
          </span>
          <h1 className="font-heading font-semibold text-hero text-cream mb-5">
            Las empanadas más queridas <span className="text-green">de Limache</span>
          </h1>
          <p className="font-body text-base sm:text-lg text-cream/80 max-w-md mb-8">
            Empanadas, parrilladas, platos caseros y eventos con el sabor de siempre.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#reservas"
              className="rounded-full bg-green text-charcoal font-body font-semibold px-7 py-3.5 hover:brightness-95 transition"
            >
              Reservar mesa
            </a>
            <a
              href="#menu"
              className="rounded-full bg-cream text-charcoal font-body font-semibold px-7 py-3.5 hover:bg-cream/90 transition"
            >
              Ver menú
            </a>
          </div>
        </div>

        <div className="relative">
          <FotoReal
            src="hero-parrillada.jpg"
            label="Foto real de parrillada Katty para el hero"
            className="w-full aspect-[4/3] object-cover rounded-3xl"
          />
        </div>
      </div>

      <div className="absolute bottom-6 sm:bottom-10 left-0 w-full px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-center lg:justify-start">
          <a
            href={waLink("Hola! Quiero la promo de 2 empanadas por $1.900")}
            target="_blank"
            rel="noopener noreferrer"
            className="brush-tag bg-yellow-fluor text-charcoal font-heading font-semibold text-sm sm:text-base px-6 py-4 shadow-card"
          >
            2 empanadas por $1.900
          </a>
          <a
            href={waLink("Hola! Quiero la promo del Vaso XL recargable")}
            target="_blank"
            rel="noopener noreferrer"
            className="brush-tag bg-green text-charcoal font-heading font-semibold text-sm sm:text-base px-6 py-4 shadow-card"
          >
            Vaso XL recargable hasta 3 veces por $2.500
          </a>
        </div>
      </div>

      <BrushDivider />
    </section>
  );
}
