"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData, DrillRecord, PracticeBlockRecord } from "@/lib/offline/DataProvider";
import {
  createPracticeBlock,
  deletePracticeBlock,
  duplicatePracticePlan,
  setPracticeAttendance,
  updatePracticeBlock,
  updatePracticePlan,
} from "@/lib/offline/actions";
import { visibleDrills } from "@/lib/practice/drills";
import { categoryLabel } from "@/lib/practice/constants";
import { computePracticeWarnings } from "@/lib/practice/validation";
import { computeAutoBalance } from "@/lib/practice/autobalance";
import { DrillInfoSheet } from "@/components/DrillInfoSheet";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  drill: "Drill",
  break: "Break",
  talk: "Talk",
  free_play: "Free Play",
};

const BREAK_PRESETS = [1, 2, 3];

export default function PracticePlanBuilderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { team, players, drills, practicePlans, practiceBlocks, practiceAttendances, mutate, deletePracticePlan, ready } =
    useData();
  const plan = practicePlans.find((p) => p.id === params.id);
  const [pickingDrill, setPickingDrill] = useState(false);
  const [pickingBreak, setPickingBreak] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [infoDrill, setInfoDrill] = useState<DrillRecord | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);

  const blocks = useMemo(
    () => practiceBlocks.filter((b) => b.planId === params.id).sort((a, b) => a.order - b.order),
    [practiceBlocks, params.id]
  );

  const activePlayers = useMemo(() => players.filter((p) => p.active).sort((a, b) => a.order - b.order), [players]);
  const attendanceByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of practiceAttendances) {
      if (a.planId === params.id) map.set(a.playerId, a.status);
    }
    return map;
  }, [practiceAttendances, params.id]);
  const presentPlayerCount = activePlayers.filter((p) => (attendanceByPlayer.get(p.id) ?? "present") !== "absent").length;

  const plannedMinutes = blocks.reduce((sum, b) => sum + b.plannedMinutes, 0);
  const warnings = useMemo(
    () => (plan ? computePracticeWarnings(plan, blocks, drills, presentPlayerCount) : []),
    [plan, blocks, drills, presentPlayerCount]
  );

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

  async function autoBalance() {
    if (!plan) return;
    const changes = computeAutoBalance(blocks, drills, plan.targetMinutes);
    for (const change of changes) {
      await updatePracticeBlock(mutate, change.blockId, { plannedMinutes: change.plannedMinutes });
    }
  }

  async function toggleAttendance(playerId: string, currentlyAbsent: boolean) {
    if (!plan) return;
    await setPracticeAttendance(mutate, plan.id, playerId, currentlyAbsent ? "present" : "absent");
  }

  async function saveAsTemplate() {
    if (!templateNameDraft.trim() || !plan) return;
    await duplicatePracticePlan(mutate, plan, blocks, { isTemplate: true, templateName: templateNameDraft.trim() });
    setSavingTemplate(false);
    setTemplateNameDraft("");
  }

  async function duplicate() {
    if (!plan) return;
    const id = await duplicatePracticePlan(mutate, plan, blocks, {});
    router.push(`/practice/plans/${id}`);
  }

  async function doDelete() {
    if (!plan) return;
    const result = await deletePracticePlan(plan.id);
    if (result.ok) {
      router.push(plan.isTemplate ? "/practice/templates" : "/practice/plans");
    } else {
      setDeleteError(result.error ?? "Delete failed.");
      setConfirmingDelete(false);
    }
  }

  let offset = 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{plan.isTemplate ? "Template" : "Practice Plan"}</h1>
        <div className="flex gap-2 shrink-0">
          {!plan.isTemplate && (
            <Link href={`/practice/plans/${plan.id}/report`} className="btn-secondary text-sm">Report</Link>
          )}
          {!plan.isTemplate && (
            <button className="btn-secondary text-sm" onClick={toggleStatus}>
              {plan.status === "draft" ? "Mark as Planned" : "Revert to Draft"}
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        {plan.isTemplate ? (
          <div>
            <p className="label">Template name</p>
            <input
              className="input"
              value={plan.templateName}
              onChange={(e) => updatePracticePlan(mutate, plan.id, { templateName: e.target.value })}
            />
          </div>
        ) : (
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
        )}
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
        {delta !== 0 && blocks.some((b) => b.type === "drill") && (
          <button className="btn-secondary w-full text-sm" onClick={autoBalance}>Auto-balance to target</button>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="card">
          <button className="w-full flex items-center justify-between p-3 min-h-touch" onClick={() => setShowWarnings((v) => !v)}>
            <span className="font-semibold">Warnings ({warnings.length})</span>
            <span className="text-slate-400 text-sm">{showWarnings ? "Hide" : "Show"}</span>
          </button>
          {showWarnings && (
            <div className="border-t border-slate-200 p-3 space-y-2">
              {warnings.map((w) => (
                <div key={w.id} className="rounded-lg px-3 py-2 bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  {w.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                <div className="flex items-start gap-1.5">
                  <p className="font-semibold">{drill ? drill.name : BLOCK_TYPE_LABELS[block.type] ?? block.type}</p>
                  {drill && (
                    <button
                      className="shrink-0 mt-0.5 w-5 h-5 rounded-full border border-slate-300 text-slate-500 text-xs font-bold leading-none flex items-center justify-center"
                      onClick={() => setInfoDrill(drill)}
                      aria-label={`About ${drill.name}`}
                    >
                      i
                    </button>
                  )}
                </div>
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
            <DrillPicker drills={visibleDrills(drills, team.id)} onPick={addDrill} onInfo={setInfoDrill} />
          </div>
        )}
      </div>

      <div className="card">
        <button className="w-full flex items-center justify-between p-3 min-h-touch" onClick={() => setShowAttendance((v) => !v)}>
          <span className="font-semibold">Attendance ({presentPlayerCount}/{activePlayers.length} present)</span>
          <span className="text-slate-400 text-sm">{showAttendance ? "Hide" : "Show"}</span>
        </button>
        {showAttendance && (
          <div className="border-t border-slate-200 p-3 space-y-2">
            {activePlayers.map((p) => {
              const absent = attendanceByPlayer.get(p.id) === "absent";
              return (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${absent ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {p.firstName} {p.lastNameInitial}
                  </span>
                  <button
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 min-h-touch ${
                      absent ? "bg-white text-slate-500 border-slate-300" : "bg-field text-white border-field"
                    }`}
                    onClick={() => toggleAttendance(p.id, absent)}
                  >
                    {absent ? "Absent" : "Present"}
                  </button>
                </div>
              );
            })}
            {activePlayers.length === 0 && <p className="text-sm text-slate-500">No active players on the roster.</p>}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <p className="label m-0">Reuse</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={duplicate}>Duplicate</button>
          {!plan.isTemplate && (
            <button className="btn-secondary flex-1" onClick={() => setSavingTemplate((v) => !v)}>Save as Template</button>
          )}
        </div>
        {savingTemplate && (
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <input
              className="input flex-1"
              placeholder="Template name"
              value={templateNameDraft}
              onChange={(e) => setTemplateNameDraft(e.target.value)}
            />
            <button className="btn-primary" disabled={!templateNameDraft.trim()} onClick={saveAsTemplate}>Save</button>
          </div>
        )}
      </div>

      <div className="card p-4 space-y-2 border-red-200">
        <p className="label m-0">Danger zone</p>
        {confirmingDelete ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-700">
              Delete this {plan.isTemplate ? "template" : "practice plan"}? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button className="btn-danger flex-1" onClick={doDelete}>Yes, delete</button>
              <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete {plan.isTemplate ? "template" : "plan"}
          </button>
        )}
        {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}
      </div>

      <DrillInfoSheet drill={infoDrill} onClose={() => setInfoDrill(null)} />
    </div>
  );
}

function DrillPicker({
  drills,
  onPick,
  onInfo,
}: {
  drills: DrillRecord[];
  onPick: (drill: DrillRecord) => void;
  onInfo: (drill: DrillRecord) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = drills
    .filter((d) => (search.trim() ? d.name.toLowerCase().includes(search.trim().toLowerCase()) : true))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-2">
      <input className="input" placeholder="Search drills..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.map((d) => (
          <div key={d.id} className="flex items-center gap-1 rounded-lg hover:bg-slate-100">
            <button className="flex-1 min-w-0 text-left px-3 py-2 flex items-center justify-between gap-2" onClick={() => onPick(d)}>
              <span className="font-medium">{d.name}</span>
              <span className="text-xs text-slate-500 shrink-0">{d.defaultMinutes} min</span>
            </button>
            <button
              className="shrink-0 mr-2 w-5 h-5 rounded-full border border-slate-300 text-slate-500 text-xs font-bold leading-none flex items-center justify-center"
              onClick={() => onInfo(d)}
              aria-label={`About ${d.name}`}
            >
              i
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500 px-1">No drills match.</p>}
      </div>
    </div>
  );
}
