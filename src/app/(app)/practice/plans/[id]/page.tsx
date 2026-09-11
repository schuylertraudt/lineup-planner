"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData, DrillRecord, PracticeBlockRecord } from "@/lib/offline/DataProvider";
import { createPracticeBlock, deletePracticeBlock, updatePracticeBlock, updatePracticePlan } from "@/lib/offline/actions";
import { visibleDrills } from "@/lib/practice/drills";
import { categoryLabel } from "@/lib/practice/constants";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  drill: "Drill",
  break: "Break",
  talk: "Talk",
  free_play: "Free Play",
};

const BREAK_PRESETS = [1, 2, 3];

export default function PracticePlanBuilderPage({ params }: { params: { id: string } }) {
  const { team, drills, drillArchives, practicePlans, practiceBlocks, mutate, ready } = useData();
  const plan = practicePlans.find((p) => p.id === params.id);
  const [pickingDrill, setPickingDrill] = useState(false);
  const [pickingBreak, setPickingBreak] = useState(false);

  const blocks = useMemo(
    () => practiceBlocks.filter((b) => b.planId === params.id).sort((a, b) => a.order - b.order),
    [practiceBlocks, params.id]
  );

  const plannedMinutes = blocks.reduce((sum, b) => sum + b.plannedMinutes, 0);

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!plan || !team) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <p className="text-slate-500">Practice plan not found.</p>
        <Link href="/practice/plans" className="btn-secondary inline-block">Back to plans</Link>
      </div>
    );
  }

  const delta = plannedMinutes - plan.targetMinutes;

  function nextOrder() {
    return blocks.length === 0 ? 0 : Math.max(...blocks.map((b) => b.order)) + 1;
  }

  async function addDrill(drill: DrillRecord) {
    await createPracticeBlock(mutate, { planId: plan!.id, order: nextOrder(), type: "drill", drillId: drill.id, plannedMinutes: drill.defaultMinutes });
    setPickingDrill(false);
  }

  async function addBreak(minutes: number) {
    await createPracticeBlock(mutate, { planId: plan!.id, order: nextOrder(), type: "break", drillId: null, plannedMinutes: minutes });
    setPickingBreak(false);
  }

  async function addTalk() {
    await createPracticeBlock(mutate, { planId: plan!.id, order: nextOrder(), type: "talk", drillId: null, plannedMinutes: 2 });
  }

  async function addFreePlay() {
    await createPracticeBlock(mutate, { planId: plan!.id, order: nextOrder(), type: "free_play", drillId: null, plannedMinutes: 5 });
  }

  async function step(block: PracticeBlockRecord, delta: number) {
    await updatePracticeBlock(mutate, block.id, { plannedMinutes: Math.max(1, block.plannedMinutes + delta) });
  }

  async function move(block: PracticeBlockRecord, direction: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === block.id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= blocks.length) return;
    const other = blocks[swapIdx];
    await updatePracticeBlock(mutate, block.id, { order: other.order });
    await updatePracticeBlock(mutate, other.id, { order: block.order });
  }

  async function removeBlock(block: PracticeBlockRecord) {
    await deletePracticeBlock(mutate, block.id, plan!.id);
  }

  async function toggleStatus() {
    await updatePracticePlan(mutate, plan!.id, { status: plan!.status === "draft" ? "planned" : "draft" });
  }

  let offset = 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Practice Plan</h1>
        <button className="btn-secondary text-sm" onClick={toggleStatus}>
          {plan.status === "draft" ? "Mark as Planned" : "Revert to Draft"}
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="label">Date</p>
            <input
              type="date"
              className="input"
              value={plan.date ? plan.date.slice(0, 10) : ""}
              onChange={(e) => updatePracticePlan(mutate, plan.id, { date: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
          <div>
            <p className="label">Location</p>
            <input
              className="input"
              value={plan.location}
              onChange={(e) => updatePracticePlan(mutate, plan.id, { location: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <p className="label m-0">Target</p>
            <input
              type="number"
              className="input w-20"
              value={plan.targetMinutes}
              onChange={(e) => updatePracticePlan(mutate, plan.id, { targetMinutes: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex-1 text-right">
            <p className="text-sm text-slate-500">Planned: <span className="font-semibold text-slate-800">{plannedMinutes} min</span></p>
            <p className={`text-sm font-semibold ${delta === 0 ? "text-emerald-700" : delta > 0 ? "text-amber-700" : "text-slate-500"}`}>
              {delta === 0 ? "On target" : delta > 0 ? `${delta} min over` : `${-delta} min under`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {blocks.map((block, i) => {
          const startOffset = offset;
          offset += block.plannedMinutes;
          const drill = block.drillId ? drills.find((d) => d.id === block.drillId) : undefined;
          return (
            <div key={block.id} className="card p-3 flex items-center gap-2">
              <div className="flex flex-col">
                <button className="btn-secondary !min-h-0 !min-w-0 px-2 py-0.5 text-xs" disabled={i === 0} onClick={() => move(block, -1)}>▲</button>
                <button className="btn-secondary !min-h-0 !min-w-0 px-2 py-0.5 text-xs mt-1" disabled={i === blocks.length - 1} onClick={() => move(block, 1)}>▼</button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 font-semibold">at {startOffset} min</p>
                <p className="font-semibold truncate">{drill ? drill.name : BLOCK_TYPE_LABELS[block.type] ?? block.type}</p>
                {drill && <p className="text-xs text-slate-500">{categoryLabel(drill.category)}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="btn-secondary !min-h-0 !min-w-0 w-8 h-8 text-lg" onClick={() => step(block, -1)}>-</button>
                <span className="w-10 text-center font-semibold">{block.plannedMinutes}</span>
                <button className="btn-secondary !min-h-0 !min-w-0 w-8 h-8 text-lg" onClick={() => step(block, 1)}>+</button>
              </div>
              <button className="btn-danger !min-h-0 px-2 py-1 text-xs shrink-0" onClick={() => removeBlock(block)}>✕</button>
            </div>
          );
        })}
        {blocks.length === 0 && <p className="text-slate-500 text-center py-6">No blocks yet. Add one below.</p>}
      </div>

      <div className="card p-4 space-y-3">
        <p className="label m-0">Add a block</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => { setPickingDrill((v) => !v); setPickingBreak(false); }}>+ Drill</button>
          <button className="btn-secondary" onClick={() => { setPickingBreak((v) => !v); setPickingDrill(false); }}>+ Break</button>
          <button className="btn-secondary" onClick={addTalk}>+ Talk</button>
          <button className="btn-secondary" onClick={addFreePlay}>+ Free Play</button>
        </div>

        {pickingBreak && (
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            {BREAK_PRESETS.map((m) => (
              <button key={m} className={`btn-secondary flex-1 ${m === 2 ? "border-field text-field" : ""}`} onClick={() => addBreak(m)}>
                {m} min
              </button>
            ))}
          </div>
        )}

        {pickingDrill && (
          <div className="pt-2 border-t border-slate-200">
            <DrillPicker drills={visibleDrills(drills, drillArchives, team.id)} onPick={addDrill} />
          </div>
        )}
      </div>
    </div>
  );
}

function DrillPicker({ drills, onPick }: { drills: DrillRecord[]; onPick: (drill: DrillRecord) => void }) {
  const [search, setSearch] = useState("");
  const filtered = drills
    .filter((d) => (search.trim() ? d.name.toLowerCase().includes(search.trim().toLowerCase()) : true))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-2">
      <input className="input" placeholder="Search drills..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.map((d) => (
          <button
            key={d.id}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2"
            onClick={() => onPick(d)}
          >
            <span className="font-medium truncate">{d.name}</span>
            <span className="text-xs text-slate-500 shrink-0">{d.defaultMinutes} min</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500 px-1">No drills match.</p>}
      </div>
    </div>
  );
}
