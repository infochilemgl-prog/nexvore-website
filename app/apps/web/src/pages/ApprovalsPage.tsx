import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, RiskBadge, Badge, Button, LoadingState, EmptyState } from "@/components/ui/primitives";
import { toast } from "sonner";

interface Approval {
  id: string;
  actionType: string;
  riskLevel: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  payload: Record<string, unknown>;
  status: string;
  requestedByAgent: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  EXECUTED: "success",
  REJECTED: "danger",
  FAILED: "danger",
  EXPIRED: "default",
};

export default function ApprovalsPage() {
  const [status, setStatus] = useState("PENDING");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Approval[]>({
    queryKey: ["approvals", status],
    queryFn: async () => (await api.get("/approvals", { params: { status } })).data,
    refetchInterval: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/approvals/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Accion aprobada y ejecutada.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "No se pudo aprobar."),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/approvals/${id}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Solicitud rechazada.");
    },
  });

  return (
    <div>
      <PageHeader
        title="Aprobaciones"
        subtitle="Acciones de Nivel 2 y Nivel 3 que requieren revision humana antes de ejecutarse."
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            {["PENDING", "APPROVED", "EXECUTED", "REJECTED", "EXPIRED", "FAILED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        }
      />
      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState message="No hay solicitudes en este estado." />
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={a.riskLevel} />
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                  <span className="text-xs text-muted">solicitado por {a.requestedByAgent ?? "usuario"}</span>
                </div>
                <div className="mt-1 text-sm font-semibold">{a.summary}</div>
                <div className="text-xs text-muted">
                  accion: {a.actionType} · entidad: {a.entityType}
                  {a.expiresAt && <> · expira {new Date(a.expiresAt).toLocaleString("es-CL")}</>}
                </div>
              </div>
              {a.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => rejectMutation.mutate(a.id)}>
                    Rechazar
                  </Button>
                  <Button onClick={() => approveMutation.mutate(a.id)}>Aprobar y ejecutar</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
