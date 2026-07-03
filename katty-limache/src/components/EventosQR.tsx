import FotoReal from "./FotoReal";
import { waLink } from "../lib/whatsapp";

const TICKET_ITEMS = [
  "Ver menú actualizado",
  "Promociones exclusivas",
  "Deja tu reseña",
  "Cotiza tu evento",
];

const EVENT_TYPES = ["Matrimonios", "Cumpleaños", "Empresas", "Coffee break", "Celebraciones"];

export default function EventosQR() {
  return (
    <section id="eventos" className="scroll-mt-20 bg-cream py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
        <div className="bg-charcoal text-cream rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div
              data-label="QR se generará con el dominio final una vez publicado el sitio"
              className="w-36 h-36 shrink-0 rounded-2xl border-2 border-dashed border-cream/30 flex flex-col items-center justify-center gap-1 text-center p-3"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-cream/40">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM19 14v3M14 19h3M19 19h1" />
              </svg>
              <span className="text-[11px] font-body text-cream/50 leading-snug">
                QR pendiente del dominio final
              </span>
            </div>

            <div>
              <p className="font-heading font-semibold text-lg mb-3">Escanea en tu mesa</p>
              <ul className="flex flex-col gap-2">
                {TICKET_ITEMS.map((item) => (
                  <li key={item} className="flex items-center gap-2 font-body text-sm text-cream/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-heading font-semibold text-section text-charcoal mb-4">
            Llevamos el sabor de Katty a tu evento
          </h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {EVENT_TYPES.map((type) => (
              <span
                key={type}
                className="rounded-full bg-green/15 text-charcoal font-body font-medium text-sm px-4 py-1.5"
              >
                {type}
              </span>
            ))}
          </div>

          <FotoReal
            src="catering-eventos.jpg"
            label="Foto real de catering para eventos Katty"
            className="w-full aspect-video object-cover rounded-3xl mb-6"
          />

          <a
            href={waLink("Hola! Quiero cotizar un evento con Katty.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-green text-charcoal font-body font-semibold px-7 py-3.5 hover:brightness-95 transition"
          >
            Cotizar evento
          </a>
        </div>
      </div>
    </section>
  );
}
