import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calculator, Bell, ChevronDown, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavMenuButton, useNavDestinations } from "./GlobalNav";

function NavItem({
  to,
  icon: Icon,
  label,
  badge,
  active,
  collapsed,
}: {
  to: string;
  icon: typeof Calculator;
  label: string;
  badge?: number;
  active: boolean;
  /** icon-only rail — the label moves into the tooltip */
  collapsed?: boolean;
}) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md py-2 text-[13px] transition-colors",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-brand-50 text-brand-700 font-medium"
          : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      <Icon className={cn("h-[16px] w-[16px]", active ? "text-brand-700" : "text-ink-400")} />
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && badge !== undefined && (
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

const COLLAPSE_KEY = "tracon.sidebarCollapsed.v1";

/**
 * Collapsed = icon-only, not hidden: navigation stays one click away instead
 * of two. Persisted, because a layout choice that resets on every page load
 * is a choice the app keeps un-making for you.
 */
function loadCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");
  // Start expanded on the server pass; the stored choice applies after
  // hydration so both passes render the same markup.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setCollapsed(loadCollapsed()), []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // ignore
      }
      return !c;
    });
  };
  // Quotation is still a STEP of the costing workflow — it is reached from the
  // Costing Report and nothing here creates one. What the sidebar offers is
  // the register: a way to FIND a quotation once it exists, which the POD it
  // was built in cannot do. The list is shared with the workspace drawer so
  // the two shells can never drift apart.
  const { primary: primaryNav, bottom: bottomNav } = useNavDestinations();

  return (
    <div className="min-h-screen w-full bg-canvas">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-hairline bg-surface transition-[width] duration-150 lg:flex",
          collapsed ? "w-[60px]" : "w-[236px]",
        )}
      >
        <div
          className={cn("flex h-14 items-center gap-2", collapsed ? "justify-center px-0" : "px-5")}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
            <span className="text-[12px] font-semibold">T</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-ink-900">Tracon</span>
              <span className="text-[10px] text-ink-400">Product Intelligence</span>
            </div>
          )}
        </div>

        {/* Workspace switcher */}
        <div className={cn("mx-3 mb-3 mt-1", collapsed && "hidden")}>
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
                collapsed={collapsed}
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
              collapsed={collapsed}
            />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className={cn(collapsed ? "lg:pl-[60px]" : "lg:pl-[236px]")}>
        {/* Top nav */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-hairline bg-canvas/80 px-6 backdrop-blur-md lg:px-10">
          {/* The same hamburger and the same drawer as the full-screen
              workspaces — below `lg` this is the only navigation there is,
              since the sidebar is hidden, and above it the drawer stays as the
              one affordance a user has to learn. The button beside it is a
              different job: it resizes the rail, it does not open a menu. */}
          <NavMenuButton className="-mr-2.5" />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={collapsed}
            className="hidden rounded-md p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 lg:inline-flex"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
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
