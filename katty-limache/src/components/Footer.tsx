import FotoReal from "./FotoReal";
import { waLink } from "../lib/whatsapp";

const MENU_LINKS = ["Empanadas", "Parrilladas", "Platos caseros", "Chorrillanas", "Hamburguesas"];
const SITE_LINKS = [
  { label: "Inicio", href: "#inicio" },
  { label: "Promociones", href: "#promociones" },
  { label: "Reservas", href: "#reservas" },
  { label: "Eventos", href: "#eventos" },
  { label: "Historia", href: "#historia" },
  { label: "Reseñas", href: "#resenas" },
];

export default function Footer() {
  return (
    <footer className="bg-charcoal text-cream pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-10 h-10 rounded-full bg-cream border-2 border-green flex items-center justify-center text-charcoal font-heading italic text-lg">
              K
            </span>
            <span className="font-heading italic text-xl">Katty</span>
          </div>
          <p className="font-body text-cream/60 text-sm max-w-xs">
            Empanadas, parrilladas, platos caseros y eventos con el sabor de
            siempre. Un proyecto familiar de Limache con más de 4 años de
            trayectoria.
          </p>
        </div>

        <div>
          <p className="font-heading font-semibold mb-4">Menú</p>
          <ul className="flex flex-col gap-2">
            {MENU_LINKS.map((item) => (
              <li key={item}>
                <a href="#menu" className="font-body text-sm text-cream/60 hover:text-green transition">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-heading font-semibold mb-4">Enlaces</p>
          <ul className="flex flex-col gap-2">
            {SITE_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="font-body text-sm text-cream/60 hover:text-green transition">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-heading font-semibold mb-4">Contacto</p>
          <ul className="flex flex-col gap-2 mb-5">
            <li>
              <a
                href={waLink("Hola Katty!")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-sm text-cream/60 hover:text-green transition"
              >
                WhatsApp
              </a>
            </li>
            <li className="font-body text-sm text-cream/60 italic">
              Dirección y horario pendientes de confirmar
            </li>
          </ul>
          <FotoReal
            src="fachada.jpg"
            label="Foto real de la fachada del local Katty"
            className="w-full aspect-video object-cover rounded-2xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-cream/10">
        <p className="font-body text-xs text-cream/60 text-center">
          © {new Date().getFullYear()} Empanadas Katty — Limache. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
