import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, LoadingState, Button } from "@/components/ui/primitives";
import { toast } from "sonner";

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  createdAt: string;
  unit: { name: string };
  property: { name: string };
  contractor: { name: string } | null;
  quotes: { id: string; amount: string; status: string; contractor: { name: string } }[];
}

const COLUMNS = ["OPEN", "TRIAGED", "QUOTE_REQUESTED", "SCHEDULED", "IN_PROGRESS", "RESOLVED"];
const URGENCY_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "default",
};

export default function MaintenancePage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Ticket[]>({
    queryKey: ["maintenance-tickets"],
    queryFn: async () => (await api.get("/maintenance/tickets")).data,
    refetchInterval: 15_000,
  });

  const { data: contractors } = useQuery({
    queryKey: ["contractors"],
    queryFn: async () => (await api.get("/maintenance/contractors")).data,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/maintenance/tickets/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      toast.success("Estado actualizado.");
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Mantenimiento"
        subtitle={`${contractors?.length ?? 0} contratistas registrados.`}
        actions={
          <button onClick={() => setView(view === "kanban" ? "list" : "kanban")} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            {view === "kanban" ? "Ver lista" : "Ver kanban"}
          </button>
        }
      />

      {view === "kanban" ? (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto md:grid-cols-6">
          {COLUMNS.map((col) => (
            <div key={col} className="min-w-[220px] rounded-2xl bg-surface-muted p-2">
              <div className="mb-2 px-2 text-xs font-semibold uppercase text-muted">{col.replace("_", " ")}</div>
              <div className="space-y-2">
                {data?.filter((t) => t.status === col).map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge tone={URGENCY_TONE[t.urgency]}>{t.urgency}</Badge>
                    </div>
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-muted">{t.property.name} · {t.unit.name}</div>
                    <select
                      value={t.status}
                      onChange={(e) => statusMutation.mutate({ id: t.id, status: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    >
                      {["OPEN", "TRIAGED", "QUOTE_REQUESTED", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {t.quotes.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                        {t.quotes.map((q) => (
                          <div key={q.id} className="flex justify-between">
                            <span>{q.contractor.name}</span>
                            <span>{q.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Titulo</th>
                <th className="p-3">Propiedad</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Urgencia</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Contratista</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3">{t.title}</td>
                  <td className="p-3 text-muted">{t.property.name} · {t.unit.name}</td>
                  <td className="p-3">{t.category}</td>
                  <td className="p-3">
                    <Badge tone={URGENCY_TONE[t.urgency]}>{t.urgency}</Badge>
                  </td>
                  <td className="p-3">{t.status}</td>
                  <td className="p-3 text-muted">{t.contractor?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="mt-6">
        <div className="mb-2 text-sm font-semibold">Contratistas</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {contractors?.map((c: any) => (
            <div key={c.id} className="rounded-xl bg-surface-muted p-3 text-xs">
              <div className="font-semibold">{c.name}</div>
              <div className="text-muted">{c.phone}</div>
              <div className="text-muted">Especialidades: {(c.specialties ?? []).join(", ")}</div>
              <div className="text-muted">Rating: {c.rating ?? "-"}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
