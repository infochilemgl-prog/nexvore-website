import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, LoadingState, EmptyState } from "@/components/ui/primitives";

interface Competitor {
  id: string;
  name: string;
  platform: string;
  threatScore: number;
  snapshots: { nightlyPrice: string | null; rating: number | null; reviewCount: number | null }[];
  reviews: { rating: number; reviewText: string; sentiment: string | null }[];
}

export default function CompetitorsPage() {
  const { data, isLoading } = useQuery<Competitor[]>({ queryKey: ["competitors"], queryFn: async () => (await api.get("/competitors")).data });

  return (
    <div>
      <PageHeader title="Inteligencia competitiva" subtitle="Precios, rating y resenas de competidores rastreados." />
      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState message="No hay competidores registrados." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => {
            const snap = c.snapshots[0];
            return (
              <Card key={c.id}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{c.name}</div>
                  <Badge tone={c.threatScore > 55 ? "danger" : c.threatScore > 30 ? "warning" : "default"}>Amenaza {c.threatScore.toFixed(0)}</Badge>
                </div>
                <div className="text-xs text-muted">{c.platform}</div>
                {snap && (
                  <div className="mt-2 text-sm">
                    <div>Precio: {snap.nightlyPrice ? `$${Number(snap.nightlyPrice).toLocaleString("es-CL")}` : "N/D"}</div>
                    <div>Rating: {snap.rating ?? "N/D"} ({snap.reviewCount ?? 0} resenas)</div>
                  </div>
                )}
                {c.reviews.length > 0 && (
                  <div className="mt-2 border-t border-border pt-2 text-xs text-muted">"{c.reviews[0].reviewText}"</div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
