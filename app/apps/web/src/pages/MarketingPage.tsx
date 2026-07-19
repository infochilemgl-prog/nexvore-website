import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, LoadingState, EmptyState } from "@/components/ui/primitives";

interface Idea {
  id: string;
  title: string;
  hook?: string;
  platform?: string;
  status: string;
  createdAt: string;
}

export default function MarketingPage() {
  const { data, isLoading } = useQuery<Idea[]>({ queryKey: ["content-ideas"], queryFn: async () => (await api.get("/competitors/content-ideas")).data });

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Ideas de contenido generadas a partir de inteligencia competitiva. Todo queda en borrador para revision humana." />
      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState message="No hay ideas de contenido todavia." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((idea) => (
            <Card key={idea.id}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{idea.title}</div>
                <Badge>{idea.status}</Badge>
              </div>
              {idea.hook && <p className="mt-1 text-sm text-muted">{idea.hook}</p>}
              <div className="mt-2 text-xs text-muted">{idea.platform ?? "Sin plataforma"} · {new Date(idea.createdAt).toLocaleDateString("es-CL")}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
