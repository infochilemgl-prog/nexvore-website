import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, LoadingState } from "@/components/ui/primitives";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart } from "recharts";

interface DailyMetric {
  date: string;
  conversationsHandled: number;
  reservationsCreated: number;
  ticketsCreated: number;
  humanEscalations: number;
  upsellRevenue: string;
  estimatedHumanMinutesSaved: number;
  aiCost: string;
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<DailyMetric[]>({
    queryKey: ["daily-metrics"],
    queryFn: async () => (await api.get("/analytics/daily-metrics", { params: { days: 14 } })).data,
  });

  const chartData = (data ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }),
    conversaciones: d.conversationsHandled,
    reservas: d.reservationsCreated,
    upsell: Number(d.upsellRevenue),
    minutosAhorrados: d.estimatedHumanMinutesSaved,
  }));

  return (
    <div>
      <PageHeader title="Analitica" subtitle="Ultimos 14 dias de metricas operativas." />
      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-2 text-sm font-semibold">Conversaciones y reservas</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="conversaciones" stroke="#243C34" strokeWidth={2} />
                <Line type="monotone" dataKey="reservas" stroke="#B86448" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div className="mb-2 text-sm font-semibold">Ingreso por upsell (CLP)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="upsell" fill="#C49A54" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="lg:col-span-2">
            <div className="mb-2 text-sm font-semibold">Minutos humanos ahorrados por dia</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="minutosAhorrados" fill="#347A57" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
