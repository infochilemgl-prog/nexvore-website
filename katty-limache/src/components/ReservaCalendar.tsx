import { useState } from "react";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

interface ReservaCalendarProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function ReservaCalendar({ selected, onSelect }: ReservaCalendarProps) {
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-full hover:bg-charcoal/10 flex items-center justify-center text-charcoal"
        >
          ‹
        </button>
        <span className="font-body font-semibold text-charcoal">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-full hover:bg-charcoal/10 flex items-center justify-center text-charcoal"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-xs font-body font-medium text-charcoal/70">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} />;
          const cellDate = startOfDay(new Date(year, month, day));
          const isPast = cellDate < today;
          const isSelected = selected && startOfDay(selected).getTime() === cellDate.getTime();

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(cellDate)}
              className={`aspect-square rounded-full text-sm font-body transition ${
                isSelected
                  ? "bg-green text-charcoal font-semibold"
                  : isPast
                  ? "text-charcoal/25 cursor-not-allowed"
                  : "text-charcoal hover:bg-charcoal/10"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
