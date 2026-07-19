import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessagesSquare,
  CalendarRange,
  Users,
  Sparkles,
  Wrench,
  BedDouble,
  BookOpen,
  Binoculars,
  Megaphone,
  BarChart3,
  ShieldCheck,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import clsx from "clsx";

const NAV_ITEMS = [
  { to: "/", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Bandeja", icon: MessagesSquare },
  { to: "/reservations", label: "Reservas", icon: CalendarRange },
  { to: "/guests", label: "Huespedes", icon: Users },
  { to: "/concierge", label: "Concierge", icon: Sparkles },
  { to: "/maintenance", label: "Mantenimiento", icon: Wrench },
  { to: "/housekeeping", label: "Housekeeping", icon: BedDouble },
  { to: "/knowledge", label: "Conocimiento", icon: BookOpen },
  { to: "/competitors", label: "Competencia", icon: Binoculars },
  { to: "/marketing", label: "Marketing", icon: Megaphone },
  { to: "/analytics", label: "Analitica", icon: BarChart3 },
  { to: "/approvals", label: "Aprobaciones", icon: ShieldCheck },
  { to: "/integrations", label: "Integraciones", icon: Plug },
  { to: "/settings", label: "Configuracion", icon: Settings },
];

export function AppShell() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background text-ink">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface p-4">
        <div className="mb-6 px-2">
          <div className="font-serif text-2xl text-forest">Nexvore</div>
          <div className="text-xs text-muted">Plataforma de operaciones con IA</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-forest text-white" : "text-ink/80 hover:bg-surface-muted"
                )
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          <div className="px-2 text-sm font-semibold">{user?.name}</div>
          <div className="px-2 text-xs text-muted">{user?.role}</div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-terracotta hover:bg-surface-muted"
          >
            <LogOut size={16} /> Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
