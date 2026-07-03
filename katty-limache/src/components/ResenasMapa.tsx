import { waLink, WHATSAPP_NUMBER } from "../lib/whatsapp";

const GOOGLE_REVIEWS_URL =
  "https://www.google.com/maps/search/?api=1&query=Empanadas+Katty+Limache";

function ReviewPlaceholder({ n }: { n: number }) {
  return (
    <div className="border-2 border-dashed border-charcoal/25 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-charcoal/10 flex items-center justify-center font-heading font-semibold text-charcoal/70">
          ?
        </span>
        <div>
          <p className="font-body font-semibold text-charcoal/70 text-sm">
            Reseña pendiente #{n}
          </p>
        </div>
      </div>
      <p className="font-body text-sm text-charcoal/70 italic">
        Aquí va una reseña real copiada de Google (nombre, iniciales y texto
        del cliente), pendiente de que el cliente la comparta.
      </p>
    </div>
  );
}

export default function ResenasMapa() {
  return (
    <section id="resenas" className="scroll-mt-20 bg-cream py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/70 border border-charcoal/10 rounded-full px-4 py-2 mb-6">
            <span className="text-charcoal font-heading">★★★★</span>
            <span className="font-body font-semibold text-charcoal">3,7</span>
            <span className="font-body text-charcoal/60 text-sm">· +66 reseñas en Google</span>
          </div>

          <div className="grid gap-4">
            <ReviewPlaceholder n={1} />
            <ReviewPlaceholder n={2} />
            <ReviewPlaceholder n={3} />
          </div>

          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 rounded-full bg-charcoal text-cream font-body font-semibold px-6 py-3 hover:brightness-110 transition"
          >
            Ver todas las reseñas en Google
          </a>
        </div>

        <div id="ubicacion" className="scroll-mt-20">
          <h2 className="font-heading font-semibold text-section text-charcoal mb-6">
            Cómo llegar
          </h2>
          <div className="bg-white/70 border border-charcoal/10 rounded-3xl p-6 sm:p-8 flex flex-col gap-5">
            <div>
              <p className="font-body font-semibold text-charcoal/70 text-sm mb-1">Dirección</p>
              <p className="font-body text-charcoal/70 italic">
                Pendiente de confirmar por el cliente (Limache).
              </p>
            </div>
            <div>
              <p className="font-body font-semibold text-charcoal/70 text-sm mb-1">Horario</p>
              <p className="font-body text-charcoal/70 italic">Pendiente de confirmar por el cliente.</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-green text-charcoal font-body font-semibold px-5 py-2.5 hover:brightness-95 transition"
              >
                Cómo llegar
              </a>
              <a
                href={waLink("Hola! Tengo una consulta sobre Katty.")}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border-2 border-charcoal text-charcoal font-body font-semibold px-5 py-2.5 hover:bg-charcoal hover:text-cream transition"
              >
                WhatsApp
              </a>
              <a
                href={`tel:+${WHATSAPP_NUMBER}`}
                className="rounded-full border-2 border-charcoal text-charcoal font-body font-semibold px-5 py-2.5 hover:bg-charcoal hover:text-cream transition"
              >
                Llamar
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
