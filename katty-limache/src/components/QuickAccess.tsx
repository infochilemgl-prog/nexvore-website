import type { ReactNode } from "react";

interface QuickLink {
  label: string;
  href: string;
  icon: ReactNode;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6 sm:w-7 sm:h-7">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LINKS: QuickLink[] = [
  { label: "Ver menú", href: "#menu", icon: <Icon d="M4 19h16M4 5h16M8 5v14M16 5v14" /> },
  { label: "Reservar mesa", href: "#reservas", icon: <Icon d="M4 10h16M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M4 10v9M20 10v9M4 15h16" /> },
  { label: "Eventos", href: "#eventos", icon: <Icon d="M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" /> },
  { label: "Promociones", href: "#promociones", icon: <Icon d="M12 3l1.9 4.2 4.6.5-3.4 3.2.9 4.6L12 13.4 7.9 15.5l.9-4.6-3.4-3.2 4.6-.5L12 3Z" /> },
  { label: "Cómo llegar", href: "#ubicacion", icon: <Icon d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /> },
  { label: "Reseñas", href: "#resenas", icon: <Icon d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19l1-5.8-4.3-4.1 5.9-.9L12 3Z" /> },
];

export default function QuickAccess() {
  return (
    <div className="relative z-20 -mt-14 sm:-mt-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto bg-cream rounded-3xl shadow-card border border-charcoal/10 px-4 py-5 sm:px-8 sm:py-6 grid grid-cols-3 sm:grid-cols-6 gap-4">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-2 text-center group"
          >
            <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green/15 text-charcoal flex items-center justify-center group-hover:bg-green/30 transition">
              {link.icon}
            </span>
            <span className="font-body text-xs sm:text-sm font-medium text-charcoal/80">
              {link.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
