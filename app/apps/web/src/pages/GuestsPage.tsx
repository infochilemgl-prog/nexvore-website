import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, LoadingState, EmptyState } from "@/components/ui/primitives";

interface Guest {
  id: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  preferredLanguage: string;
  createdAt: string;
}

export default function GuestsPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<Guest[]>({
    queryKey: ["guests", q],
    queryFn: async () => (await api.get("/guests", { params: q ? { q } : {} })).data,
  });

  return (
    <div>
      <PageHeader
        title="Huespedes"
        subtitle="Directorio de huespedes de la organizacion."
        actions={
          <input
            placeholder="Buscar por nombre, telefono o email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
        }
      />
      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState message="No hay huespedes." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Telefono</th>
                <th className="p-3">Email</th>
                <th className="p-3">Idioma</th>
                <th className="p-3">Desde</th>
              </tr>
            </thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="p-3 font-medium">{g.firstName} {g.lastName ?? ""}</td>
                  <td className="p-3 text-muted">{g.phone ?? "-"}</td>
                  <td className="p-3 text-muted">{g.email ?? "-"}</td>
                  <td className="p-3 text-muted">{g.preferredLanguage}</td>
                  <td className="p-3 text-muted">{new Date(g.createdAt).toLocaleDateString("es-CL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
