import { useState } from "react";
import { waLink } from "../lib/whatsapp";

const NAV_LINKS = [
  { label: "Inicio", href: "#inicio" },
  { label: "Menú", href: "#menu" },
  { label: "Promociones", href: "#promociones" },
  { label: "Reservas", href: "#reservas" },
  { label: "Eventos", href: "#eventos" },
  { label: "Historia", href: "#historia" },
  { label: "Reseñas", href: "#resenas" },
  { label: "Ubicación", href: "#ubicacion" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-charcoal/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="#inicio" className="flex items-center gap-2 shrink-0">
          <span className="w-10 h-10 rounded-full bg-charcoal border-2 border-green flex items-center justify-center text-cream font-heading italic text-lg">
            K
          </span>
          <span className="font-heading italic text-xl text-charcoal hidden sm:inline">
            Katty
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-body font-medium text-charcoal/80 hover:text-charcoal transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <a
            href="#reservas"
            className="rounded-full bg-green text-charcoal font-body font-semibold text-sm px-5 py-2.5 hover:brightness-95 transition"
          >
            Reservar mesa
          </a>
          <a
            href={waLink("Hola Katty! Quisiera hacer una consulta.")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border-2 border-charcoal text-charcoal font-body font-semibold text-sm px-5 py-2.5 hover:bg-charcoal hover:text-cream transition"
          >
            WhatsApp
          </a>
        </div>

        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden flex flex-col gap-1.5 p-2"
        >
          <span className="w-6 h-0.5 bg-charcoal" />
          <span className="w-6 h-0.5 bg-charcoal" />
          <span className="w-6 h-0.5 bg-charcoal" />
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-cream border-t border-charcoal/10 px-4 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm font-body font-medium text-charcoal/80 py-1"
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <a
              href="#reservas"
              onClick={() => setOpen(false)}
              className="flex-1 text-center rounded-full bg-green text-charcoal font-body font-semibold text-sm px-4 py-2.5"
            >
              Reservar mesa
            </a>
            <a
              href={waLink("Hola Katty! Quisiera hacer una consulta.")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center rounded-full border-2 border-charcoal text-charcoal font-body font-semibold text-sm px-4 py-2.5"
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
