import FotoReal from "./FotoReal";
import ReservaForm from "./ReservaForm";
import { waLink } from "../lib/whatsapp";

const PROMOS = [
  {
    title: "2 empanadas por $1.900",
    photo: { src: "promo-2-empanadas.jpg", label: "Foto de la promo 2 empanadas" },
    tag: "yellow-fluor" as const,
    link: waLink("Hola! Quiero la promo de 2 empanadas por $1.900"),
  },
  {
    title: "Vaso XL recargable hasta 3 veces por $2.500",
    photo: { src: "promo-vaso-xl.jpg", label: "Foto de la promo Vaso XL" },
    tag: "green" as const,
    link: waLink("Hola! Quiero la promo del Vaso XL recargable"),
  },
  {
    title: "Combo familiar — Consultar",
    photo: { src: "promo-combo.jpg", label: "Foto del combo familiar" },
    tag: "green" as const,
    link: waLink("Hola! Quiero saber del combo familiar"),
  },
  {
    title: "Promo de la semana — Ver en Instagram",
    photo: { src: "promo-semana.jpg", label: "Foto de la promo de la semana" },
    tag: "yellow-fluor" as const,
    link: "https://www.instagram.com/",
  },
];

export default function Promociones() {
  return (
    <section id="promociones" className="scroll-mt-20 bg-charcoal/[0.03] py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="font-heading font-semibold text-section text-charcoal mb-8">
            Promociones
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {PROMOS.map((promo) => (
              <a
                key={promo.title}
                href={promo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="relative rounded-2xl overflow-hidden bg-white/60 border border-charcoal/10 group"
              >
                <FotoReal
                  src={promo.photo.src}
                  label={promo.photo.label}
                  className="w-full aspect-video object-cover"
                />
                <span
                  className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-body font-semibold text-charcoal ${
                    promo.tag === "yellow-fluor" ? "bg-yellow-fluor" : "bg-green"
                  }`}
                >
                  Promo
                </span>
                <div className="p-4">
                  <p className="font-heading font-semibold text-charcoal leading-snug">
                    {promo.title}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <ReservaForm />
      </div>
    </section>
  );
}
