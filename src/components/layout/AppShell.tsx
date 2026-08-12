import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calculator, Settings, HelpCircle, Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePods } from "@/lib/podsStore";

const bottomNav = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help", url: "/help", icon: HelpCircle },
];

function NavItem({
  to,
  icon: Icon,
  label,
  badge,
  active,
}: {
  to: string;
  icon: typeof Calculator;
  label: string;
  badge?: number;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
        active
          ? "bg-brand-50 text-brand-700 font-medium"
          : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      <Icon className={cn("h-[16px] w-[16px]", active ? "text-brand-700" : "text-ink-400")} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            active ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-500",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const pods = usePods();
  const activePods = pods.filter(
    (p) => p.status === "in_progress" || p.status === "pending_approval",
  ).length;
  const badgeOf = (n: number) => (hydrated && n > 0 ? n : undefined);
  // Quotation is a STEP of the costing workflow, not a destination beside it —
  // so it is reached from Costing Report, and the sidebar does not offer a
  // second, parallel way in.
  const primaryNav: { title: string; url: string; icon: typeof Calculator; badge?: number }[] = [
    { title: "Costing", url: "/pods", icon: Calculator, badge: badgeOf(activePods) },
  ];

  return (
    <div className="min-h-screen w-full bg-canvas">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-hairline bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
            <span className="text-[12px] font-semibold">T</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-ink-900">Tracon</span>
            <span className="text-[10px] text-ink-400">Product Intelligence</span>
          </div>
        </div>

        {/* Workspace switcher */}
        <div className="mx-3 mb-3 mt-1">
          <button className="flex w-full items-center gap-2 rounded-md border border-hairline bg-surface-alt px-2.5 py-1.5 text-left hover:bg-ink-50">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-ink-900 text-[10px] font-medium text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-ink-900">Aarav Textiles</div>
            </div>
            <ChevronDown className="h-3 w-3 text-ink-400" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          <div className="space-y-0.5">
            {primaryNav.map((it) => (
              <NavItem
                key={it.title}
                to={it.url}
                icon={it.icon}
                label={it.title}
                badge={it.badge}
                active={isActive(it.url)}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-hairline p-3 space-y-0.5">
          {bottomNav.map((it) => (
            <NavItem
              key={it.title}
              to={it.url}
              icon={it.icon}
              label={it.title}
              active={isActive(it.url)}
            />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[236px]">
        {/* Top nav */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-hairline bg-canvas/80 px-6 backdrop-blur-md lg:px-10">
          <div className="flex items-center gap-2 text-[12px] text-ink-400">
            <span>Workspace</span>
            <span className="text-ink-300">/</span>
            <span className="text-ink-900">Home</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              className="rounded-md p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="sr-only">Notifications</span>
            </button>
            <div className="mx-1 h-6 w-px bg-hairline" />
            <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-surface-alt">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-500 text-[11px] font-medium text-white">
                GK
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-[12px] font-medium text-ink-900">Gautam Kitclu</div>
                <div className="text-[10px] text-ink-400">Admin</div>
              </div>
              <ChevronDown className="hidden h-3 w-3 text-ink-400 sm:block" />
            </button>
          </div>
        </header>

        <main className="px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
