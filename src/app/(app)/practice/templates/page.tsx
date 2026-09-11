"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/offline/DataProvider";
import { duplicatePracticePlan } from "@/lib/offline/actions";

export default function PracticeTemplatesPage() {
  const router = useRouter();
  const { practicePlans, practiceBlocks, mutate, ready } = useData();

  const templates = useMemo(
    () => practicePlans.filter((p) => p.isTemplate).sort((a, b) => a.templateName.localeCompare(b.templateName)),
    [practicePlans]
  );

  async function useTemplate(templateId: string) {
    const template = practicePlans.find((p) => p.id === templateId);
    if (!template) return;
    const blocks = practiceBlocks.filter((b) => b.planId === templateId);
    const id = await duplicatePracticePlan(mutate, template, blocks, {});
    router.push(`/practice/plans/${id}`);
  }

  if (!ready) return <p className="p-6 text-slate-500">Loading templates...</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Templates</h1>
        <Link href="/practice/plans" className="text-sm font-semibold text-field underline">Back to plans</Link>
      </div>
      <p className="text-sm text-slate-500">
        Save a practice plan as a template (from its Reuse section) to quickly build future practices from it.
      </p>

      <div className="space-y-2">
        {templates.map((t) => {
          const blocks = practiceBlocks.filter((b) => b.planId === t.id);
          const minutes = blocks.reduce((sum, b) => sum + b.plannedMinutes, 0);
          return (
            <div key={t.id} className="card p-4 flex items-center justify-between gap-2">
              <Link href={`/practice/plans/${t.id}`} className="min-w-0 flex-1">
                <p className="font-semibold truncate">{t.templateName || "Untitled template"}</p>
                <p className="text-sm text-slate-500">{blocks.length} block{blocks.length === 1 ? "" : "s"} · {minutes} min</p>
              </Link>
              <button className="btn-primary text-sm shrink-0" onClick={() => useTemplate(t.id)}>Use</button>
            </div>
          );
        })}
        {templates.length === 0 && <p className="text-slate-500 text-center py-8">No templates yet.</p>}
      </div>
    </div>
  );
}
