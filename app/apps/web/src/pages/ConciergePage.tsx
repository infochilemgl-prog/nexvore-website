import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, LoadingState, EmptyState } from "@/components/ui/primitives";
import { formatCurrency } from "@hospitality-ai/shared";

interface Service {
  id: string;
  name: string;
  category: string;
  price: string;
  currency: string;
  requiresApproval: boolean;
}

interface Booking {
  id: string;
  scheduledAt: string;
  quantity: number;
  totalAmount: string;
  status: string;
  service: { name: string };
  guest: { firstName: string };
}

export default function ConciergePage() {
  const { data: services, isLoading } = useQuery<Service[]>({ queryKey: ["services"], queryFn: async () => (await api.get("/services")).data });
  const { data: bookings } = useQuery<Booking[]>({ queryKey: ["service-bookings"], queryFn: async () => (await api.get("/services/bookings")).data });

  return (
    <div>
      <PageHeader title="Concierge" subtitle="Servicios adicionales disponibles y reservas de servicio." />
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services?.map((s) => (
            <Card key={s.id}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{s.name}</div>
                {s.requiresApproval && <Badge tone="warning">Requiere aprobacion</Badge>}
              </div>
              <div className="text-xs text-muted">{s.category}</div>
              <div className="mt-2 font-serif text-xl text-forest">{formatCurrency(Number(s.price), s.currency)}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">Reservas de servicio recientes</div>
        {!bookings?.length ? (
          <EmptyState message="No hay reservas de servicio." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase text-muted">
                <tr>
                  <th className="p-3">Servicio</th>
                  <th className="p-3">Huesped</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="p-3">{b.service.name}</td>
                    <td className="p-3 text-muted">{b.guest.firstName}</td>
                    <td className="p-3 text-muted">{new Date(b.scheduledAt).toLocaleString("es-CL")}</td>
                    <td className="p-3">{formatCurrency(Number(b.totalAmount))}</td>
                    <td className="p-3">
                      <Badge tone={b.status === "PENDING_APPROVAL" ? "warning" : "default"}>{b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
