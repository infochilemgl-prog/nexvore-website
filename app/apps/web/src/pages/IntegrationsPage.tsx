import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";

interface IntegrationsState {
  aiProvider: { provider: string; configured: boolean };
  whatsapp: { provider: string; configured: boolean };
  voice: { provider: string; configured: boolean };
  google: { provider: string; configured: boolean };
  slack: { provider: string; configured: boolean };
  pms: { provider: string; configured: boolean };
  payments: { provider: string; configured: boolean };
  storage: { provider: string; configured: boolean };
  flags: Record<string, boolean>;
}

const LABELS: Record<string, string> = {
  aiProvider: "Proveedor de IA",
  whatsapp: "WhatsApp (Twilio)",
  voice: "Voz",
  google: "Google (Calendar/Gmail/Drive)",
  slack: "Slack",
  pms: "PMS",
  payments: "Pagos",
  storage: "Almacenamiento",
};

export default function IntegrationsPage() {
  const { data } = useQuery<IntegrationsState>({ queryKey: ["integrations"], queryFn: async () => (await api.get("/integrations")).data });

  return (
    <div>
      <PageHeader title="Integraciones" subtitle="Estado real de cada conexion. Sin credenciales configuradas, el sistema corre en modo simulado (mock)." />
      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(LABELS).map(([key, label]) => {
              const state = (data as any)[key];
              return (
                <Card key={key}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{label}</div>
                    <Badge tone={state.configured ? "success" : "default"}>{state.configured ? "Configurada" : "No configurada"}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted">Proveedor: {state.provider}</div>
                </Card>
              );
            })}
          </div>
          <Card className="mt-6">
            <div className="mb-2 text-sm font-semibold">Banderas de seguridad</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {Object.entries(data.flags).map(([flag, value]) => (
                <div key={flag} className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-sm">
                  <span>{flag}</span>
                  <Badge tone={value ? "success" : "warning"}>{value ? "ON" : "OFF"}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
