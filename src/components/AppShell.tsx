"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DataProvider, useData } from "@/lib/offline/DataProvider";
import { SyncIndicator } from "@/components/SyncIndicator";
import { BottomNav } from "@/components/BottomNav";

/**
 * Every route in this app is a client component that renders from
 * IndexedDB, so the only thing a cold, offline reload of e.g. /roster or
 * /games/[id] is missing is the full HTML document itself (client-side tab
 * navigation only ever triggers an RSC data fetch, not a full page fetch).
 * This warms the service worker's cache with that full document in the
 * background whenever a route is visited online, so a later hard reload or
 * PWA relaunch of that same URL still works with no network at all.
 */
function OfflineShellWarmer() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.onLine || !("serviceWorker" in navigator)) return;
    fetch(pathname, { headers: { "X-SW-Warm": "doc" }, credentials: "include" }).catch(() => {});
  }, [pathname]);
  return null;
}

function TopBar({ coachName }: { coachName: string }) {
  const router = useRouter();
  const { team } = useData();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-30 bg-field text-white px-4 py-2 flex items-center justify-between" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}>
      <div className="min-w-0">
        <p className="font-bold truncate leading-tight">{team?.name ?? "Lineup Planner"}</p>
        <p className="text-xs text-emerald-100 truncate leading-tight">{coachName}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <SyncIndicator />
        <button onClick={logout} className="text-xs font-semibold underline decoration-emerald-200 min-h-touch px-1">
          Sign out
        </button>
      </div>
    </header>
  );
}

export function AppShell({
  coachId,
  coachName,
  children,
}: {
  coachId: string;
  coachName: string;
  children: React.ReactNode;
}) {
  return (
    <DataProvider coachId={coachId}>
      <OfflineShellWarmer />
      <div className="min-h-screen pb-20 flex flex-col">
        <TopBar coachName={coachName} />
        <main className="flex-1">{children}</main>
        <BottomNav />
      </div>
    </DataProvider>
  );
}
