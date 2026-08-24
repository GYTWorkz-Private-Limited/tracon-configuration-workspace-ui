/**
 * Global navigation for the full-screen workspaces.
 *
 * The sidebar in `AppShell` costs 236px of width, which the costing sheet, the
 * costing report and the quotation workspaces do not have to give — so those
 * screens shipped with no way out except the browser back button. This is the
 * same navigation in the only shape those screens can host: a 36px strip, plus
 * a drawer that holds the full destination list.
 *
 * One destination list serves both shells (`useNavDestinations`), so the menu a
 * user learns on the dashboard is the menu they get inside a workspace.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calculator, FileText, HelpCircle, Menu, Settings, X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePods } from "@/lib/podsStore";
import { useAllQuoteDrafts } from "@/lib/quoteDraftStore";

export type NavDestination = {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: number;
};

const bottomDestinations: NavDestination[] = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help", url: "/help", icon: HelpCircle },
];

/**
 * Counts come from client-only stores, so they are withheld until after
 * hydration — a badge that appears on the second render is better than markup
 * that disagrees with the server pass.
 */
export function useNavDestinations(): { primary: NavDestination[]; bottom: NavDestination[] } {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const pods = usePods();
  const quotations = useAllQuoteDrafts();
  const activePods = pods.filter(
    (p) => p.status === "in_progress" || p.status === "pending_approval",
  ).length;
  const badgeOf = (n: number) => (hydrated && n > 0 ? n : undefined);

  return {
    primary: [
      { title: "Costing", url: "/pods", icon: Calculator, badge: badgeOf(activePods) },
      {
        title: "Quotations",
        url: "/quotations",
        icon: FileText,
        badge: badgeOf(quotations.length),
      },
    ],
    bottom: bottomDestinations,
  };
}

/**
 * The hamburger and the drawer it controls, as one unit — the two are useless
 * apart and every host needs both, so callers cannot wire them up wrongly.
 * `AppShell` and the workspace bar both render this.
 */
export function NavMenuButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Open navigation menu"
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
          className,
        )}
      >
        <Menu className="h-4 w-4" />
      </button>
      <NavDrawer
        id={panelId}
        open={open}
        onClose={() => {
          setOpen(false);
          // Dismissing a menu should not dump focus at the top of the
          // document; it goes back where the user opened it from.
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}

function NavDrawer({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { primary, bottom } = useNavDestinations();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Move into the panel so the first Tab continues inside it rather than
    // wandering back through the workspace behind the backdrop.
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Portalled to the body because the hosts are not neutral: the AppShell
  // header uses `backdrop-blur`, and the workspace frame a transform, and both
  // of those make themselves the containing block for `position: fixed` — the
  // overlay would be trapped inside a 56px header instead of covering the app.
  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink-900/25" onClick={onClose} aria-hidden />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 flex w-[264px] flex-col border-r border-hairline bg-surface shadow-xl"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white">
            <span className="text-[12px] font-semibold">T</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-ink-900">Tracon</span>
            <span className="text-[10px] text-ink-400">Product Intelligence</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {primary.map((d) => (
            <DrawerLink
              key={d.title}
              destination={d}
              active={isActive(d.url)}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-hairline p-3">
          {bottom.map((d) => (
            <DrawerLink
              key={d.title}
              destination={d}
              active={isActive(d.url)}
              onNavigate={onClose}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DrawerLink({
  destination,
  active,
  onNavigate,
}: {
  destination: NavDestination;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = destination.icon;
  return (
    <Link
      to={destination.url}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        active
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      <Icon className={cn("h-[16px] w-[16px]", active ? "text-brand-700" : "text-ink-400")} />
      <span className="flex-1">{destination.title}</span>
      {destination.badge !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            active ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-500",
          )}
        >
          {destination.badge}
        </span>
      )}
    </Link>
  );
}

/**
 * The strip itself. Deliberately 36px and text-free apart from the mark: it
 * sits above a ProductHeader that already carries the article's identity, and
 * anything taller is height taken from the sheet the user came to work on.
 */
export function GlobalNav({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 border-b border-hairline bg-surface px-3",
        className,
      )}
    >
      <NavMenuButton />
      <Link
        to="/pods"
        aria-label="Tracon home"
        className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-700 text-[10px] font-semibold text-white">
          T
        </span>
        <span className="text-[12px] font-semibold text-ink-900">Tracon</span>
      </Link>
    </div>
  );
}

/**
 * Wrapper for workspaces that claim the viewport themselves (`h-screen`, or in
 * the costing report's case `fixed inset-0`). Two things make it work:
 * the transform turns this box into the containing block for those fixed
 * children, so a full-screen overlay fills the area *below* the strip instead
 * of covering it; and forcing the child to `h-full` stops its own `100vh` from
 * pushing 36px past the fold and growing a second scrollbar.
 */
export function GlobalNavFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      <GlobalNav />
      <div className="relative min-h-0 flex-1 [transform:translateZ(0)] [&>*]:!h-full">
        {children}
      </div>
    </div>
  );
}
