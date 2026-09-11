"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/offline/DataProvider";
import { createPracticePlan } from "@/lib/offline/actions";

export default function PracticePlansPage() {
  const router = useRouter();
  const { team, practicePlans, ready, mutate } = useData();

  const sorted = useMemo(
    () =>
      practicePlans
        .filter((p) => !p.isTemplate)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [practicePlans]
  );

  async function addPlan() {
    if (!team) return;
    const id = await createPracticePlan(mutate, { teamId: team.id, date: null, location: "", targetMinutes: team.targetMinutes });
    router.push(`/practice/plans/${id}`);
  }

  if (!ready) return <p className="p-6 text-slate-500">Loading practice plans...</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Practice Plans</h1>
        <button className="btn-primary" onClick={addPlan}>+ New Practice</button>
      </div>

      <div className="space-y-2">
        {sorted.map((p) => (
          <Link key={p.id} href={`/practice/plans/${p.id}`} className="card p-4 flex items-center justify-between block">
            <div>
              <p className="font-semibold">
                {p.date
                  ? new Date(p.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                  : "No date set"}
              </p>
              <p className="text-sm text-slate-500">{p.location || "No location set"} · {p.targetMinutes} min target</p>
            </div>
            <StatusBadge status={p.status} />
          </Link>
        ))}
        {sorted.length === 0 && <p className="text-slate-500 text-center py-8">No practice plans yet. Create your first one above.</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    planned: "bg-emerald-100 text-emerald-800",
  };
  const labels: Record<string, string> = { draft: "Draft", planned: "Planned" };
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles[status] ?? styles.draft}`}>{labels[status] ?? status}</span>;
}
