"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";
import { blockLabel, equipmentChecklist, textSummaryFromPracticePlan } from "@/lib/practice/report";
import { categoryLabel } from "@/lib/practice/constants";

export default function PracticePlanReportPage({ params }: { params: { id: string } }) {
  const { drills, practicePlans, practiceBlocks, ready } = useData();
  const plan = practicePlans.find((p) => p.id === params.id);
  const [copyStatus, setCopyStatus] = useState("");

  const blocks = useMemo(
    () => practiceBlocks.filter((b) => b.planId === params.id).sort((a, b) => a.order - b.order),
    [practiceBlocks, params.id]
  );
  const equipment = useMemo(() => equipmentChecklist(blocks, drills), [blocks, drills]);
  const plannedMinutes = blocks.reduce((sum, b) => sum + b.plannedMinutes, 0);

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <p className="text-slate-500">Practice plan not found.</p>
        <Link href="/practice/plans" className="btn-secondary inline-block">Back to plans</Link>
      </div>
    );
  }

  async function copyText() {
    const text = textSummaryFromPracticePlan(plan!, blocks, drills);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied!");
    } catch {
      setCopyStatus("Copy failed — select and copy manually.");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }

  let offset = 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
        <button className="btn-secondary" onClick={copyText}>Copy as text</button>
        {copyStatus && <span className="text-sm text-emerald-700 font-semibold self-center">{copyStatus}</span>}
      </div>

      <div className="card p-4 space-y-1">
        <h1 className="text-xl font-bold">
          {plan.date
            ? new Date(plan.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : "Practice Plan"}
        </h1>
        <p className="text-slate-500">
          {plan.location ? `${plan.location} · ` : ""}
          {plannedMinutes} min planned ({plan.targetMinutes} min target)
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-3 py-2 font-bold">Start</th>
              <th className="text-left px-3 py-2 font-bold">Block</th>
              <th className="text-left px-3 py-2 font-bold">Min</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => {
              const startOffset = offset;
              offset += block.plannedMinutes;
              const drill = block.drillId ? drills.find((d) => d.id === block.drillId) : undefined;
              return (
                <tr key={block.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap font-semibold">{startOffset} min</td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{blockLabel(block, drills)}</p>
                    {drill && (
                      <div className="text-xs text-slate-600 space-y-0.5 mt-0.5">
                        <p>{categoryLabel(drill.category)}</p>
                        {drill.setup && <p>Setup: {drill.setup}</p>}
                        {drill.instructions && <p>{drill.instructions}</p>}
                        {drill.coachingPoints.length > 0 && <p>Coaching points: {drill.coachingPoints.join("; ")}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{block.plannedMinutes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {equipment.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="font-bold">Equipment checklist</p>
          <ul className="space-y-1 text-sm">
            {equipment.map((item) => (
              <li key={item}>☐ {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
