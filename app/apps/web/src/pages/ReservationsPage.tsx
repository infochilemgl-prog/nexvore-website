import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, LoadingState, EmptyState } from "@/components/ui/primitives";
import { formatCurrency } from "@hospitality-ai/shared";

interface Reservation {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  currency: string;
  adults: number;
  children: number;
  source: string;
  unit: { name: string };
  guest: { firstName: string; lastName?: string };
  property: { name: string };
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  CONFIRMED: "success",
  CHECKED_IN: "success",
  PENDING: "warning",
  AWAITING_PAYMENT: "warning",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

export default function ReservationsPage() {
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");

  const { data, isLoading } = useQuery<Reservation[]>({
    queryKey: ["reservations", status],
    queryFn: async () => (await api.get("/reservations", { params: status ? { status } : {} })).data,
  });

  const occupancyByProperty = useMemo(() => {
    if (!data) return {};
    const map: Record<string, number> = {};
    for (const r of data) {
      if (["CONFIRMED", "CHECKED_IN"].includes(r.status)) {
        map[r.property.name] = (map[r.property.name] ?? 0) + 1;
      }
    }
    return map;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Reservas"
        subtitle="Vista de lista y ocupacion. Filtra por estado."
        actions={
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <option value="">Todos los estados</option>
              {["INQUIRY", "PENDING", "AWAITING_PAYMENT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={() => setView(view === "list" ? "calendar" : "list")} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              {view === "list" ? "Ver calendario" : "Ver lista"}
            </button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(occupancyByProperty).map(([name, count]) => (
          <Card key={name}>
            <div className="text-xs font-medium uppercase text-muted">{name}</div>
            <div className="font-serif text-2xl text-forest">{count} activas</div>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState message="No hay reservas para este filtro." />
      ) : view === "list" ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Huesped</th>
                <th className="p-3">Propiedad / Unidad</th>
                <th className="p-3">Check-in</th>
                <th className="p-3">Check-out</th>
                <th className="p-3">Huespedes</th>
                <th className="p-3">Total</th>
                <th className="p-3">Origen</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.guest.firstName} {r.guest.lastName ?? ""}</td>
                  <td className="p-3 text-muted">{r.property.name} · {r.unit.name}</td>
                  <td className="p-3">{new Date(r.checkIn).toLocaleDateString("es-CL")}</td>
                  <td className="p-3">{new Date(r.checkOut).toLocaleDateString("es-CL")}</td>
                  <td className="p-3">{r.adults + r.children}</td>
                  <td className="p-3">{formatCurrency(Number(r.totalAmount), r.currency)}</td>
                  <td className="p-3 text-muted">{r.source}</td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[r.status] ?? "default"}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card>
          <div className="space-y-2">
            {data
              .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-sm">
                  <span className="font-semibold">{new Date(r.checkIn).toLocaleDateString("es-CL")} → {new Date(r.checkOut).toLocaleDateString("es-CL")}</span>
                  <span>{r.unit.name}</span>
                  <span className="text-muted">{r.guest.firstName}</span>
                  <Badge tone={STATUS_TONE[r.status] ?? "default"}>{r.status}</Badge>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
