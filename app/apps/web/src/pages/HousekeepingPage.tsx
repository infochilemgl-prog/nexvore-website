import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, LoadingState, EmptyState } from "@/components/ui/primitives";
import { toast } from "sonner";

interface Task {
  id: string;
  status: string;
  scheduledAt: string;
  unit: { name: string };
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  VERIFIED: "success",
  ISSUE_FOUND: "danger",
};

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Task[]>({ queryKey: ["housekeeping-tasks"], queryFn: async () => (await api.get("/housekeeping/tasks")).data });
  const { data: inventory } = useQuery({ queryKey: ["inventory"], queryFn: async () => (await api.get("/housekeeping/inventory")).data });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/housekeeping/tasks/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["housekeeping-tasks"] });
      toast.success("Tarea actualizada.");
    },
  });

  return (
    <div>
      <PageHeader title="Housekeeping" subtitle="Tareas de limpieza programadas e inventario." />
      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState message="No hay tareas de limpieza." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Unidad</th>
                <th className="p-3">Programada</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3">{t.unit.name}</td>
                  <td className="p-3 text-muted">{new Date(t.scheduledAt).toLocaleString("es-CL")}</td>
                  <td className="p-3">
                    <select
                      value={t.status}
                      onChange={(e) => statusMutation.mutate({ id: t.id, status: e.target.value })}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    >
                      {["PENDING", "IN_PROGRESS", "COMPLETED", "VERIFIED", "ISSUE_FOUND"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Badge tone={STATUS_TONE[t.status]}> {t.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {Boolean(inventory?.length) && (
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold">Inventario</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {inventory.map((i: any) => (
              <Card key={i.id} className="p-3">
                <div className="text-sm font-semibold">{i.name}</div>
                <div className="text-xs text-muted">{i.currentQuantity} {i.unitOfMeasure}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
