"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";
import { computeFocusAreaCoverage } from "@/lib/practice/report";

export default function PracticeLogPage() {
  const { drills, practicePlans, practiceBlocks, ready } = useData();

  const seasonPlans = useMemo(() => practicePlans.filter((p) => !p.isTemplate), [practicePlans]);
  const blocksByPlan = useMemo(() => {
    const map = new Map<string, typeof practiceBlocks>();
    for (const plan of seasonPlans) {
      map.set(plan.id, practiceBlocks.filter((b) => b.planId === plan.id));
    }
    return map;
  }, [seasonPlans, practiceBlocks]);

  const coverage = useMemo(() => computeFocusAreaCoverage(seasonPlans, blocksByPlan, drills), [seasonPlans, blocksByPlan, drills]);
  const maxMinutes = Math.max(1, ...coverage.map((c) => c.minutes));

  const sortedPlans = useMemo(() => [...seasonPlans].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")), [seasonPlans]);

  if (!ready) return <p className="p-6 text-slate-500">Loading practice log...</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Practice Log</h1>
        <Link href="/practice/plans" className="text-sm font-semibold text-field underline">Back to plans</Link>
      </div>

      <div className="card p-4 space-y-3">
        <p className="font-semibold">Focus area coverage (season)</p>
        <div className="space-y-2">
          {coverage.map((c) => (
            <div key={c.area} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{c.label}</span>
                <span className="text-slate-500">{c.minutes} min</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-field rounded-full" style={{ width: `${(c.minutes / maxMinutes) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="label">All practices ({sortedPlans.length})</p>
        {sortedPlans.map((p) => {
          const blocks = blocksByPlan.get(p.id) ?? [];
          const minutes = blocks.reduce((sum, b) => sum + b.plannedMinutes, 0);
          return (
            <Link key={p.id} href={`/practice/plans/${p.id}`} className="card p-4 flex items-center justify-between block">
              <div>
                <p className="font-semibold">
                  {p.date
                    ? new Date(p.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                    : "No date set"}
                </p>
                <p className="text-sm text-slate-500">{p.location || "No location set"} · {minutes} min</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.status === "planned" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {p.status === "planned" ? "Planned" : "Draft"}
              </span>
            </Link>
          );
        })}
        {sortedPlans.length === 0 && <p className="text-slate-500 text-center py-8">No practices logged yet.</p>}
      </div>
    </div>
  );
}
