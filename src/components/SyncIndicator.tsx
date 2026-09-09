"use client";

import { useData } from "@/lib/offline/DataProvider";

export function SyncIndicator() {
  const { syncStatus, pendingCount } = useData();

  const label =
    syncStatus === "offline"
      ? pendingCount > 0
        ? `Offline · ${pendingCount} pending`
        : "Offline"
      : syncStatus === "syncing"
      ? "Syncing..."
      : syncStatus === "pending"
      ? `${pendingCount} pending`
      : "Synced";

  const color =
    syncStatus === "offline"
      ? "bg-amber-500"
      : syncStatus === "synced"
      ? "bg-emerald-600"
      : "bg-sky-500";

  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-white" aria-live="polite">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
