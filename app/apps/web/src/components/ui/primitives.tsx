import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-2xl border border-border bg-surface p-5 shadow-sm", className)} {...rest}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="font-serif text-3xl text-forest">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

export function Button({
  className,
  variant = "primary",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants: Record<string, string> = {
    primary: "bg-forest text-white hover:bg-forest-soft",
    secondary: "bg-surface-muted text-ink hover:bg-border",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "bg-transparent text-ink hover:bg-surface-muted",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...rest}
    />
  );
}

const RISK_COLORS: Record<string, string> = {
  LEVEL_0: "bg-surface-muted text-muted",
  LEVEL_1: "bg-success/10 text-success",
  LEVEL_2: "bg-warning/15 text-warning",
  LEVEL_3: "bg-danger/15 text-danger",
};

export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", RISK_COLORS[level] ?? "bg-surface-muted text-muted")}>
      {level.replace("LEVEL_", "Nivel ")}
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones: Record<string, string> = {
    default: "bg-surface-muted text-ink",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
  };
  return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl text-forest">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{message}</div>;
}

export function LoadingState() {
  return <div className="p-8 text-center text-sm text-muted">Cargando...</div>;
}
