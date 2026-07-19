import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, StatTile, LoadingState, Card } from "@/components/ui/primitives";
import { formatCurrency } from "@nexvore/shared";

interface Overview {
  arrivals: number;
  departures: number;
  occupancy: number;
  occupiedUnits: number;
  totalUnits: number;
  pendingMessages: number;
  urgentTickets: number;
  cleaningTasksToday: number;
  pendingApprovals: number;
  upsellRevenueToday: number;
  aiCostToday: number;
}

export default function OverviewPage() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["analytics-overview"],
    queryFn: async () => (await api.get("/analytics/overview")).data,
    refetchInterval: 30_000,
  });

  return (
    <div>
      <PageHeader title="Resumen operativo" subtitle="Estado de hoy en todas tus propiedades." />
      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Llegadas hoy" value={data.arrivals} />
            <StatTile label="Salidas hoy" value={data.departures} />
            <StatTile label="Ocupacion" value={`${data.occupancy}%`} hint={`${data.occupiedUnits}/${data.totalUnits} unidades`} />
            <StatTile label="Mensajes pendientes" value={data.pendingMessages} />
            <StatTile label="Casos urgentes" value={data.urgentTickets} />
            <StatTile label="Tareas de aseo hoy" value={data.cleaningTasksToday} />
            <StatTile label="Aprobaciones pendientes" value={data.pendingApprovals} />
            <StatTile label="Upsell hoy" value={formatCurrency(data.upsellRevenueToday)} />
          </div>
          <Card className="mt-4">
            <div className="text-sm text-muted">Costo de IA acumulado hoy (todas las propiedades)</div>
            <div className="font-serif text-2xl text-forest">${data.aiCostToday.toFixed(4)} USD (estimado)</div>
          </Card>
        </>
      )}
    </div>
  );
}
