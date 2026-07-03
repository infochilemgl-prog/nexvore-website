import { useState } from "react";
import ReservaCalendar from "./ReservaCalendar";
import { waLink } from "../lib/whatsapp";

const HOURS = [
  "12:30", "13:00", "13:30", "14:00", "14:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
];

const DATE_FORMAT = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function ReservaForm() {
  const [date, setDate] = useState<Date | null>(null);
  const [people, setPeople] = useState("2");
  const [hour, setHour] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const isComplete = date && hour && name.trim() && phone.trim();

  const message = date
    ? `Hola! Quiero reservar mesa para ${people} personas el ${DATE_FORMAT.format(
        date
      )} a las ${hour || "___"}. Mi nombre es ${name || "___"} y mi teléfono es ${
        phone || "___"
      }.`
    : "Hola! Quiero reservar una mesa.";

  return (
    <div id="reservas" className="scroll-mt-24 bg-white/70 border border-charcoal/10 rounded-3xl p-6 sm:p-8">
      <h3 className="font-heading font-semibold text-xl text-charcoal mb-6">
        Reserva tu mesa
      </h3>

      <ReservaCalendar selected={date} onSelect={setDate} />

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body font-medium text-charcoal/70">Personas</span>
          <select
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            className="rounded-xl border border-charcoal/20 bg-cream px-3 py-2.5 font-body text-charcoal"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "persona" : "personas"}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body font-medium text-charcoal/70">Hora</span>
          <select
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            className="rounded-xl border border-charcoal/20 bg-cream px-3 py-2.5 font-body text-charcoal"
          >
            <option value="">Selecciona una hora</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body font-medium text-charcoal/70">Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="rounded-xl border border-charcoal/20 bg-cream px-3 py-2.5 font-body text-charcoal placeholder:text-charcoal/60"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body font-medium text-charcoal/70">Teléfono</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56 9 ..."
            className="rounded-xl border border-charcoal/20 bg-cream px-3 py-2.5 font-body text-charcoal placeholder:text-charcoal/60"
          />
        </label>
      </div>

      <a
        href={waLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!isComplete}
        onClick={(e) => {
          if (!isComplete) e.preventDefault();
        }}
        className={`mt-6 w-full flex items-center justify-center gap-2 rounded-full font-body font-semibold px-6 py-3.5 transition ${
          isComplete
            ? "bg-green text-charcoal hover:brightness-95"
            : "bg-charcoal/10 text-charcoal/40 cursor-not-allowed"
        }`}
      >
        Reservar por WhatsApp
      </a>
      {!isComplete && (
        <p className="text-xs font-body text-charcoal/70 mt-2 text-center">
          Completa fecha, hora, nombre y teléfono para continuar.
        </p>
      )}
    </div>
  );
}
