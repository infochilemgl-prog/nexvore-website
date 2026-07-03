import { useState } from "react";
import FotoReal from "./FotoReal";

interface MenuItem {
  name: string;
  price: string;
}

interface MenuCategory {
  id: string;
  label: string;
  photo: { src: string; label: string };
  items: MenuItem[];
}

const CATEGORIES: MenuCategory[] = [
  {
    id: "empanadas",
    label: "Empanadas",
    photo: { src: "empanadas-mural.jpg", label: "Mural con variedades de empanadas Katty" },
    items: [
      { name: "Pino", price: "Consulta en el local" },
      { name: "Napolitana", price: "Consulta en el local" },
      { name: "Queso Jamón", price: "Consulta en el local" },
      { name: "Queso Aceituna", price: "Consulta en el local" },
      { name: "Queso Camarón", price: "Consulta en el local" },
      { name: "Queso Champiñón", price: "Consulta en el local" },
      { name: "Queso Palmito", price: "Consulta en el local" },
      { name: "Queso Choclo", price: "Consulta en el local" },
    ],
  },
  {
    id: "parrilladas",
    label: "Parrilladas",
    photo: { src: "parrillada-grupo.jpg", label: "Parrillada para grupo Katty" },
    items: [
      { name: "Bife / Mechada a lo Pobre", price: "$8.990" },
      { name: "Costillar al Horno", price: "$12.990" },
      { name: "Lomo a la Plancha", price: "$12.990" },
      { name: "Lomo a lo Pobre", price: "$13.990" },
      { name: "Parrillada 1 persona", price: "$18.990" },
      { name: "Parrillada 2 personas", price: "$29.990" },
      { name: "Parrillada 3 personas", price: "$39.990" },
      { name: "Parrillada 4 personas", price: "$49.990" },
      { name: "Parrillada 6 personas", price: "$69.990" },
    ],
  },
  {
    id: "caseros",
    label: "Platos caseros",
    photo: { src: "cazuela.jpg", label: "Cazuela de vacuno casera Katty" },
    items: [
      { name: "Pollo al Horno", price: "$5.000" },
      { name: "Pulpa Arvejada", price: "$5.000" },
      { name: "Pastel de Choclo", price: "$5.000" },
      { name: "Cazuela de Vacuno", price: "$6.000" },
      { name: "Chuleta a la Plancha", price: "$6.000" },
      { name: "Pescado Frito", price: "$7.000" },
      { name: "Pechuga a la Plancha", price: "$8.000" },
      { name: "Carne Mechada", price: "$8.000" },
    ],
  },
  {
    id: "chorrillanas",
    label: "Chorrillanas",
    photo: { src: "chorrillana.jpg", label: "Chorrillana Katty" },
    items: [{ name: "Chorrillana", price: "$6.500" }],
  },
  {
    id: "hamburguesas",
    label: "Hamburguesas",
    photo: { src: "hamburguesas-katty.jpg", label: "Hamburguesas Katty" },
    items: [{ name: "Hamburguesa Katty", price: "Consulta en el local" }],
  },
];

export default function Menu() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const category = CATEGORIES.find((c) => c.id === active)!;

  return (
    <section id="menu" className="bg-cream py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading font-semibold text-section text-charcoal text-center mb-3">
          Nuestro menú
        </h2>
        <p className="font-body text-charcoal/70 text-center max-w-xl mx-auto mb-10">
          Sabores caseros que nos han acompañado por más de 4 años en Limache.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.id)}
              className={`rounded-full px-5 py-2.5 font-body font-semibold text-sm transition ${
                active === cat.id
                  ? "bg-green text-charcoal"
                  : "bg-charcoal/5 text-charcoal/70 hover:bg-charcoal/10"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <FotoReal
            src={category.photo.src}
            label={category.photo.label}
            className="w-full aspect-[4/3] object-cover rounded-3xl"
          />

          <div className="grid sm:grid-cols-2 gap-3">
            {category.items.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 bg-white/60 border border-charcoal/10 rounded-2xl px-4 py-3.5"
              >
                <span className="font-body font-medium text-charcoal">{item.name}</span>
                {item.price.startsWith("$") ? (
                  <span className="bg-green text-charcoal font-heading font-semibold rounded-full px-3 py-1 whitespace-nowrap">
                    {item.price}
                  </span>
                ) : (
                  <span className="bg-yellow-fluor text-charcoal text-xs font-body font-semibold rounded-full px-3 py-1 whitespace-nowrap">
                    {item.price}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
