import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge, Button, LoadingState, EmptyState } from "@/components/ui/primitives";
import { toast } from "sonner";
import clsx from "clsx";

interface ConversationSummary {
  id: string;
  status: string;
  channel: string;
  assignedAgent: string | null;
  urgency: string | null;
  lastMessageAt: string;
  guest: { firstName: string; lastName?: string; phone?: string } | null;
  property: { name: string };
  messages: { content: string }[];
}

interface Message {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
  aiGenerated: boolean;
}

interface ConversationDetail extends ConversationSummary {
  messages: Message[];
  reservation?: { id: string; status: string; checkIn: string; checkOut: string } | null;
}

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery<ConversationSummary[]>({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get("/conversations")).data,
    refetchInterval: 10_000,
  });

  const activeId = selectedId ?? conversations?.[0]?.id ?? null;

  const { data: detail } = useQuery<ConversationDetail>({
    queryKey: ["conversation", activeId],
    queryFn: async () => (await api.get(`/conversations/${activeId}`)).data,
    enabled: Boolean(activeId),
    refetchInterval: 8_000,
  });

  const replyMutation = useMutation({
    mutationFn: async () => api.post(`/conversations/${activeId}/reply`, { content: reply }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Respuesta enviada.");
    },
    onError: () => toast.error("No se pudo enviar la respuesta."),
  });

  const closeMutation = useMutation({
    mutationFn: async () => api.post(`/conversations/${activeId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversacion cerrada.");
    },
  });

  const noteMutation = useMutation({
    mutationFn: async () => api.post(`/conversations/${activeId}/note`, { content: note }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      toast.success("Nota agregada.");
    },
  });

  const ticketMutation = useMutation({
    mutationFn: async () =>
      api.post(`/conversations/${activeId}/create-ticket`, {
        title: `Ticket desde conversacion ${activeId?.slice(0, 6)}`,
        description: detail?.messages[detail.messages.length - 1]?.content ?? "Reportado desde bandeja de entrada.",
      }),
    onSuccess: () => toast.success("Ticket de mantenimiento creado."),
    onError: () => toast.error("No se pudo crear el ticket."),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 gap-4 md:grid-cols-[280px_1fr_260px]">
      <div className="overflow-y-auto rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-3 text-sm font-semibold">Conversaciones</div>
        {!conversations?.length && <EmptyState message="No hay conversaciones." />}
        {conversations?.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={clsx("block w-full border-b border-border p-3 text-left hover:bg-surface-muted", activeId === c.id && "bg-surface-muted")}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{c.guest ? `${c.guest.firstName} ${c.guest.lastName ?? ""}` : "Sin huesped"}</span>
              {c.urgency === "CRITICAL" && <Badge tone="danger">Critico</Badge>}
            </div>
            <div className="text-xs text-muted">{c.property?.name}</div>
            <div className="mt-1 truncate text-xs text-muted">{c.messages[0]?.content}</div>
            <div className="mt-1 flex gap-1">
              <Badge tone={c.status === "OPEN" ? "success" : c.status === "ESCALATED" ? "danger" : "default"}>{c.status}</Badge>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col rounded-2xl border border-border bg-surface">
        {!detail ? (
          <EmptyState message="Selecciona una conversacion." />
        ) : (
          <>
            <div className="border-b border-border p-3">
              <div className="text-sm font-semibold">{detail.guest ? `${detail.guest.firstName} ${detail.guest.lastName ?? ""}` : "Huesped"}</div>
              <div className="text-xs text-muted">{detail.channel} · agente: {detail.assignedAgent ?? "sin asignar"}</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {detail.messages.map((m) => (
                <div key={m.id} className={clsx("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.senderType === "GUEST" ? "bg-surface-muted" : "ml-auto bg-forest text-white")}>
                  <div>{m.content}</div>
                  <div className={clsx("mt-1 text-[10px]", m.senderType === "GUEST" ? "text-muted" : "text-white/70")}>
                    {m.senderType}
                    {m.aiGenerated ? " · IA" : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
                  onKeyDown={(e) => e.key === "Enter" && reply.trim() && replyMutation.mutate()}
                />
                <Button onClick={() => reply.trim() && replyMutation.mutate()} disabled={replyMutation.isPending}>
                  Enviar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        <div className="text-sm font-semibold">Contexto</div>
        {detail?.reservation && (
          <div className="rounded-xl bg-surface-muted p-3 text-xs">
            <div className="font-semibold">Reserva {detail.reservation.status}</div>
            <div>{new Date(detail.reservation.checkIn).toLocaleDateString("es-CL")} - {new Date(detail.reservation.checkOut).toLocaleDateString("es-CL")}</div>
          </div>
        )}
        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => activeId && closeMutation.mutate()}>
            Cerrar conversacion
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => activeId && ticketMutation.mutate()}>
            Crear ticket de mantenimiento
          </Button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Nota interna</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-border bg-background p-2 text-xs outline-none focus:border-forest"
            rows={3}
          />
          <Button variant="ghost" className="mt-1 w-full" onClick={() => note.trim() && activeId && noteMutation.mutate()}>
            Agregar nota
          </Button>
        </div>
      </div>
    </div>
  );
}
