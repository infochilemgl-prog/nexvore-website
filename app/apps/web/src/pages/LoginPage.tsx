import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/primitives";

// En desarrollo local (npm run dev) el panel entra solo con el usuario demo,
// sin pedir login -- pensado para demos de venta donde no querés que un
// prospecto se quede trabado en una pantalla de credenciales. Esto NUNCA
// corre en el build de produccion (import.meta.env.DEV es false ahi), asi
// que el login sigue siendo obligatorio una vez desplegado en nexvore.com.
const AUTO_LOGIN_EN_DEV = import.meta.env.DEV;

async function loginConCredenciales(
  email: string,
  password: string,
  setSession: (token: string, user: any) => void
) {
  const { data } = await api.post("/auth/login", { email, password });
  setSession(data.token, data.user);
}

export default function LoginPage() {
  const [email, setEmail] = useState("admin@andeshospitality.demo");
  const [password, setPassword] = useState("Demo1234!");
  const [loading, setLoading] = useState(AUTO_LOGIN_EN_DEV);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const intentoAutomatico = useRef(false);

  useEffect(() => {
    if (!AUTO_LOGIN_EN_DEV || intentoAutomatico.current) return;
    intentoAutomatico.current = true;
    loginConCredenciales(email, password, setSession)
      .then(() => navigate("/"))
      .catch((err) => {
        // Si el auto-login falla (ej. la base todavia no tiene el seed
        // corrido), no se rompe nada -- simplemente se muestra el
        // formulario normal para reintentar a mano.
        console.warn("Auto-login demo fallo, mostrando formulario:", err?.response?.data?.error ?? err?.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginConCredenciales(email, password, setSession);
      navigate("/");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  if (AUTO_LOGIN_EN_DEV && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted">Entrando a Nexvore...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="font-serif text-3xl text-forest">Nexvore</div>
          <p className="mt-1 text-sm text-muted">Plataforma de operaciones con IA</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">Demo: admin@andeshospitality.demo / Demo1234!</p>
      </div>
    </div>
  );
}
