import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card } from "@/components/ui/primitives";
import { useAuthStore } from "@/stores/auth";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: org } = useQuery({ queryKey: ["organization"], queryFn: async () => (await api.get("/organizations/me")).data });

  return (
    <div>
      <PageHeader title="Configuracion" subtitle="Datos de la organizacion y usuario actual." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-2 text-sm font-semibold">Organizacion</div>
          {org && (
            <div className="space-y-1 text-sm text-muted">
              <div>Nombre: {org.name}</div>
              <div>Slug: {org.slug}</div>
              <div>Zona horaria: {org.timezone}</div>
              <div>Moneda: {org.currency}</div>
              <div>Locale: {org.locale}</div>
            </div>
          )}
        </Card>
        <Card>
          <div className="mb-2 text-sm font-semibold">Usuario actual</div>
          <div className="space-y-1 text-sm text-muted">
            <div>Nombre: {user?.name}</div>
            <div>Email: {user?.email}</div>
            <div>Rol: {user?.role}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
