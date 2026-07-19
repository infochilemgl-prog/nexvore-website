import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, Button, LoadingState, EmptyState } from "@/components/ui/primitives";
import { toast } from "sonner";

interface Doc {
  id: string;
  title: string;
  category: string;
  content: string;
  version: number;
  active: boolean;
  updatedAt: string;
  resources: { id: string; title: string; resourceType: string }[];
}

interface Gap {
  id: string;
  question: string;
  status: string;
  createdAt: string;
}

export default function KnowledgePage() {
  const [tab, setTab] = useState<"documents" | "gaps">("documents");
  const [form, setForm] = useState({ title: "", category: "General", content: "" });
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useQuery<Doc[]>({
    queryKey: ["knowledge-documents"],
    queryFn: async () => (await api.get("/knowledge/documents")).data,
  });

  const { data: gaps } = useQuery<Gap[]>({
    queryKey: ["knowledge-gaps"],
    queryFn: async () => (await api.get("/knowledge/gaps", { params: { status: "OPEN" } })).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post("/knowledge/documents", form),
    onSuccess: () => {
      setForm({ title: "", category: "General", content: "" });
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      toast.success("Documento creado.");
    },
  });

  const approveGapMutation = useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => api.post(`/knowledge/gaps/${id}/approve`, { proposedAnswer: answer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-gaps"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      toast.success("Brecha aprobada, nuevo documento creado.");
    },
  });

  return (
    <div>
      <PageHeader title="Base de conocimiento" subtitle="Documentos, versiones y brechas detectadas por los agentes." />

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("documents")} className={`rounded-xl px-3 py-2 text-sm ${tab === "documents" ? "bg-forest text-white" : "bg-surface-muted"}`}>
          Documentos
        </button>
        <button onClick={() => setTab("gaps")} className={`rounded-xl px-3 py-2 text-sm ${tab === "gaps" ? "bg-forest text-white" : "bg-surface-muted"}`}>
          Brechas ({gaps?.length ?? 0})
        </button>
      </div>

      {tab === "documents" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {isLoading ? (
              <LoadingState />
            ) : !docs?.length ? (
              <EmptyState message="No hay documentos." />
            ) : (
              docs.map((d) => (
                <Card key={d.id}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{d.title}</div>
                    <Badge>{d.category}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{d.content}</p>
                  <div className="mt-2 text-xs text-muted">v{d.version} · {new Date(d.updatedAt).toLocaleDateString("es-CL")} · {d.resources.length} recursos</div>
                </Card>
              ))
            )}
          </div>
          <Card>
            <div className="mb-2 text-sm font-semibold">Nuevo documento</div>
            <input
              placeholder="Titulo"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
            <input
              placeholder="Categoria"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
            <textarea
              placeholder="Contenido"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
            <Button className="w-full" disabled={!form.title || !form.content} onClick={() => createMutation.mutate()}>
              Crear documento
            </Button>
          </Card>
        </div>
      ) : (
        <div className="space-y-3">
          {!gaps?.length ? (
            <EmptyState message="No hay brechas de conocimiento abiertas." />
          ) : (
            gaps.map((g) => <GapRow key={g.id} gap={g} onApprove={(answer) => approveGapMutation.mutate({ id: g.id, answer })} />)
          )}
        </div>
      )}
    </div>
  );
}

function GapRow({ gap, onApprove }: { gap: Gap; onApprove: (answer: string) => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <Card>
      <div className="text-sm font-semibold">{gap.question}</div>
      <div className="mt-1 text-xs text-muted">Pregunta sin respuesta detectada el {new Date(gap.createdAt).toLocaleString("es-CL")}</div>
      <textarea
        placeholder="Respuesta propuesta..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
      />
      <Button className="mt-2" disabled={!answer.trim()} onClick={() => onApprove(answer)}>
        Aprobar y publicar
      </Button>
    </Card>
  );
}
