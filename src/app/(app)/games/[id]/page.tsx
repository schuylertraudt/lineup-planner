"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData, AssignmentRecord } from "@/lib/offline/DataProvider";
import { setAssignment, setAvailability, setGamePeriodStatus, updateGame } from "@/lib/offline/actions";
import {
  computeSeasonTotals,
  computeGamePlanCounts,
  computeGamePlanGroupTotals,
  getAssignment,
  getPeriodAssignments,
} from "@/lib/gameFairness";
import { generatePlan } from "@/lib/autofill";
import { displayName, emptyTotals, SlotTemplate } from "@/lib/types";
import { PlayerPicker, PickerCandidate } from "@/components/PlayerPicker";

type Mode = "plan" | "live";

export default function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const router = useRouter();
  const { games, players, slots, availabilities, assignments, gamePeriods, mutate, deleteGame, ready } = useData();
  const game = games.find((g) => g.id === gameId);

  const [mode, setMode] = useState<Mode>("plan");
  const [deleting, setDeleting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const [picker, setPicker] = useState<{ periodNumber: number; slotIndex: number } | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);

  const slotTemplate: SlotTemplate[] = useMemo(
    () => [...slots].sort((a, b) => a.order - b.order).map((s) => ({ index: s.order, name: s.name, group: s.group })),
    [slots]
  );

  const activePlayers = useMemo(() => players.filter((p) => p.active).sort((a, b) => a.order - b.order), [players]);

  const availabilityByPlayer = useMemo(() => {
    const map: Record<string, "available" | "absent" | "late"> = {};
    for (const a of availabilities) {
      if (a.gameId === gameId) map[a.playerId] = a.status;
    }
    return map;
  }, [availabilities, gameId]);

  const availablePlayerIds = useMemo(
    () => activePlayers.filter((p) => (availabilityByPlayer[p.id] ?? "available") !== "absent").map((p) => p.id),
    [activePlayers, availabilityByPlayer]
  );

  const seasonTotals = useMemo(
    () => computeSeasonTotals(assignments, slots, gamePeriods, availabilities, activePlayers.map((p) => p.id)),
    [assignments, slots, gamePeriods, availabilities, activePlayers]
  );
  const isActual = mode === "live";
  const gamePlanCounts = useMemo(
    () => computeGamePlanCounts(assignments, gameId, isActual),
    [assignments, gameId, isActual]
  );
  const gamePlanGroupTotals = useMemo(
    () => computeGamePlanGroupTotals(assignments, gameId, slots, isActual),
    [assignments, gameId, slots, isActual]
  );

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!game) return <p className="p-6 text-slate-500">Game not found. It may still be syncing.</p>;

  const periodCount = game.periodCount;

  async function handleAvailabilityChange(playerId: string, status: "available" | "absent" | "late") {
    await setAvailability(mutate, gameId, playerId, status);
    if (status === "absent") {
      for (let p = 1; p <= periodCount; p++) {
        for (const slot of slotTemplate) {
          const a = getAssignment(assignments, gameId, p, slot.index, false);
          if (a?.playerId === playerId) {
            await setAssignment(mutate, gameId, p, slot.index, null, false);
          }
        }
      }
    }
  }

  function buildCandidates(periodNumber: number, excludeSlotIndex: number): PickerCandidate[] {
    const periodAssignments = getPeriodAssignments(assignments, gameId, periodNumber, isActual);
    return availablePlayerIds
      .map((id) => activePlayers.find((p) => p.id === id)!)
      .filter(Boolean)
      .map((player) => ({
        player,
        seasonTotals: seasonTotals[player.id] ?? emptyTotals(),
        gameTotals: gamePlanGroupTotals[player.id] ?? emptyTotals(),
        assignedElsewhereThisPeriod: periodAssignments.some((a) => a.playerId === player.id && a.slotIndex !== excludeSlotIndex),
      }));
  }

  async function handleSelectPlayer(periodNumber: number, slotIndex: number, playerId: string) {
    const periodAssignments = getPeriodAssignments(assignments, gameId, periodNumber, isActual);
    const existingElsewhere = periodAssignments.find((a) => a.playerId === playerId && a.slotIndex !== slotIndex);
    if (existingElsewhere) {
      await setAssignment(mutate, gameId, periodNumber, existingElsewhere.slotIndex, null, isActual);
    }
    await setAssignment(mutate, gameId, periodNumber, slotIndex, playerId, isActual);
    setPicker(null);
  }

  async function handleClearSlot(periodNumber: number, slotIndex: number) {
    await setAssignment(mutate, gameId, periodNumber, slotIndex, null, isActual);
    setPicker(null);
  }

  async function runAutofill(reset: boolean) {
    if (reset) {
      const ok = window.confirm("This clears the entire draft plan and regenerates it. Manual work will be lost. Continue?");
      if (!ok) return;
    }
    const lockedPlan = reset
      ? undefined
      : Array.from({ length: periodCount }, (_, p) =>
          slotTemplate.map((slot) => getAssignment(assignments, gameId, p + 1, slot.index, false)?.playerId ?? null)
        );

    const plan = generatePlan({
      slots: slotTemplate,
      periodCount,
      availablePlayerIds,
      seasonTotals,
      lockedPlan,
    });

    for (let p = 0; p < periodCount; p++) {
      for (const slot of slotTemplate) {
        const existing = getAssignment(assignments, gameId, p + 1, slot.index, false)?.playerId ?? null;
        const next = plan[p][slot.index] ?? null;
        if (existing !== next) {
          await setAssignment(mutate, gameId, p + 1, slot.index, next, false);
        }
      }
    }
  }

  async function startGame() {
    await updateGame(mutate, gameId, { status: "in_progress" });
    setMode("live");
  }

  async function startPeriod(periodNumber: number) {
    await setGamePeriodStatus(mutate, gameId, periodNumber, "in_progress", { startedAt: new Date().toISOString() });
    // Seed the actual layer from the plan the first time this period goes live.
    for (const slot of slotTemplate) {
      const actual = getAssignment(assignments, gameId, periodNumber, slot.index, true);
      if (!actual) {
        const planned = getAssignment(assignments, gameId, periodNumber, slot.index, false)?.playerId ?? null;
        await setAssignment(mutate, gameId, periodNumber, slot.index, planned, true);
      }
    }
  }

  async function completePeriod(periodNumber: number) {
    await setGamePeriodStatus(mutate, gameId, periodNumber, "completed", { completedAt: new Date().toISOString() });
    if (periodNumber < periodCount) setSelectedPeriod(periodNumber + 1);
  }

  async function finishGame() {
    await updateGame(mutate, gameId, { status: "final" });
  }

  async function handleDeleteGame() {
    const ok = window.confirm(`Delete the game vs ${game!.opponent}? This permanently removes its plan, live record, and report. This cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    const result = await deleteGame(gameId);
    setDeleting(false);
    if (!result.ok) {
      window.alert(result.error ?? "Delete failed.");
      return;
    }
    router.push("/season");
  }

  const periodStatus = (p: number) => gamePeriods.find((gp) => gp.gameId === gameId && gp.periodNumber === p)?.status ?? "planned";

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">vs {game.opponent}</h1>
          <p className="text-sm text-slate-500">
            {new Date(game.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {game.location ? ` · ${game.location}` : ""} · {periodCount} periods
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Link href={`/games/${gameId}/report`} className="btn-secondary text-sm">Report</Link>
          <button className="text-xs text-red-700 font-semibold min-h-touch px-1" onClick={handleDeleteGame} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete game"}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button className={`btn-secondary flex-1 ${mode === "plan" ? "!bg-field !text-white !border-field" : ""}`} onClick={() => setMode("plan")}>
          Plan
        </button>
        <button
          className={`btn-secondary flex-1 ${mode === "live" ? "!bg-field !text-white !border-field" : ""}`}
          onClick={() => setMode("live")}
        >
          Live
        </button>
      </div>

      {mode === "live" && game.status === "planned" && (
        <div className="card p-4 text-center space-y-3">
          <p className="text-slate-600">Start the game to begin tracking actual assignments period by period.</p>
          <button className="btn-primary w-full" onClick={startGame}>Start game</button>
        </div>
      )}

      <div className="card">
        <button className="w-full flex items-center justify-between p-3 min-h-touch" onClick={() => setShowAvailability((v) => !v)}>
          <span className="font-semibold">Availability</span>
          <span className="text-slate-400 text-sm">{showAvailability ? "Hide" : "Manage"}</span>
        </button>
        {showAvailability && (
          <div className="border-t border-slate-200 divide-y divide-slate-100">
            {activePlayers.map((p) => {
              const status = availabilityByPlayer[p.id] ?? "available";
              return (
                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                  <span>{displayName(p)}</span>
                  <div className="flex gap-1">
                    {(["available", "late", "absent"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleAvailabilityChange(p.id, s)}
                        className={`text-xs font-bold px-2 py-1.5 rounded min-h-touch ${
                          status === s
                            ? s === "absent"
                              ? "bg-red-600 text-white"
                              : s === "late"
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s === "available" ? "In" : s === "late" ? "Late" : "Out"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mode === "plan" && (
        <div className="flex gap-2">
          <button className="btn-secondary flex-1 text-sm" onClick={() => runAutofill(false)}>Auto-fill empty</button>
          <button className="btn-secondary flex-1 text-sm" onClick={() => runAutofill(true)}>Reset &amp; auto-fill</button>
        </div>
      )}

      {(mode === "plan" || game.status !== "planned") && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setSelectedPeriod(p);
                  setViewAll(false);
                }}
                className={`shrink-0 min-h-touch px-4 rounded-lg font-semibold text-sm ${
                  !viewAll && selectedPeriod === p ? "bg-field text-white" : "bg-white border-2 border-slate-200 text-slate-600"
                }`}
              >
                P{p}
                {mode === "live" && periodStatus(p) === "completed" && " ✓"}
              </button>
            ))}
            <button
              onClick={() => setViewAll(true)}
              className={`shrink-0 min-h-touch px-4 rounded-lg font-semibold text-sm ${
                viewAll ? "bg-field text-white" : "bg-white border-2 border-slate-200 text-slate-600"
              }`}
            >
              All
            </button>
          </div>

          {viewAll ? (
            <AllPeriodsGrid
              periodCount={periodCount}
              slotTemplate={slotTemplate}
              assignments={assignments}
              gameId={gameId}
              isActual={isActual}
              players={activePlayers}
              onCellTap={(p, s) => {
                setSelectedPeriod(p);
                setViewAll(false);
                setPicker({ periodNumber: p, slotIndex: s });
              }}
            />
          ) : (
            <PeriodEditor
              periodNumber={selectedPeriod}
              slotTemplate={slotTemplate}
              assignments={assignments}
              gameId={gameId}
              isActual={isActual}
              players={activePlayers}
              availablePlayerIds={availablePlayerIds}
              gamePlanCounts={gamePlanCounts}
              onSlotTap={(slotIndex) => setPicker({ periodNumber: selectedPeriod, slotIndex })}
            />
          )}

          {mode === "live" && !viewAll && (
            <div className="card p-3 space-y-2">
              {periodStatus(selectedPeriod) !== "in_progress" && periodStatus(selectedPeriod) !== "completed" && (
                <button className="btn-primary w-full" onClick={() => startPeriod(selectedPeriod)}>
                  Start period {selectedPeriod}
                </button>
              )}
              {periodStatus(selectedPeriod) === "in_progress" && (
                <button className="btn-primary w-full" onClick={() => completePeriod(selectedPeriod)}>
                  Complete period {selectedPeriod}
                </button>
              )}
              {periodStatus(selectedPeriod) === "completed" && selectedPeriod === periodCount && game.status !== "final" && (
                <button className="btn-primary w-full" onClick={finishGame}>
                  Finish game
                </button>
              )}
            </div>
          )}
        </>
      )}

      {picker && (
        <PlayerPicker
          open
          slotName={slotTemplate[picker.slotIndex]?.name ?? ""}
          slotGroup={slotTemplate[picker.slotIndex]?.group ?? "D"}
          candidates={buildCandidates(picker.periodNumber, picker.slotIndex)}
          onSelect={(playerId) => handleSelectPlayer(picker.periodNumber, picker.slotIndex, playerId)}
          onClear={() => handleClearSlot(picker.periodNumber, picker.slotIndex)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function PeriodEditor({
  periodNumber,
  slotTemplate,
  assignments,
  gameId,
  isActual,
  players,
  availablePlayerIds,
  gamePlanCounts,
  onSlotTap,
}: {
  periodNumber: number;
  slotTemplate: SlotTemplate[];
  assignments: AssignmentRecord[];
  gameId: string;
  isActual: boolean;
  players: { id: string; firstName: string; lastNameInitial: string; jerseyNumber: string }[];
  availablePlayerIds: string[];
  gamePlanCounts: Record<string, number>;
  onSlotTap: (slotIndex: number) => void;
}) {
  const playerById = (id: string | null) => (id ? players.find((p) => p.id === id) : undefined);
  const assignedIds = new Set(
    getPeriodAssignments(assignments, gameId, periodNumber, isActual)
      .map((a) => a.playerId)
      .filter(Boolean) as string[]
  );
  const bench = availablePlayerIds.filter((id) => !assignedIds.has(id)).map((id) => playerById(id)).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="card divide-y divide-slate-100">
        {slotTemplate.map((slot) => {
          const assignment = getAssignment(assignments, gameId, periodNumber, slot.index, isActual);
          const player = playerById(assignment?.playerId ?? null);
          return (
            <button key={slot.index} className="w-full flex items-center justify-between px-4 py-3 min-h-touch text-left" onClick={() => onSlotTap(slot.index)}>
              <span className="text-xs font-bold text-slate-400 w-10 shrink-0">{slot.name}</span>
              {player ? (
                <span className="flex-1 font-semibold">{displayName(player)}</span>
              ) : (
                <span className="flex-1 text-slate-400">Tap to assign</span>
              )}
              <span className="text-xs text-slate-400">{gamePlanCounts[player?.id ?? ""] ?? 0} pd</span>
            </button>
          );
        })}
      </div>

      <div className="card p-3">
        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Bench this period</p>
        {bench.length === 0 ? (
          <p className="text-sm text-slate-400">Nobody on the bench.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bench.map((p) => (
              <span key={p!.id} className="text-sm bg-slate-100 rounded-full px-3 py-1">
                {displayName(p!)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AllPeriodsGrid({
  periodCount,
  slotTemplate,
  assignments,
  gameId,
  isActual,
  players,
  onCellTap,
}: {
  periodCount: number;
  slotTemplate: SlotTemplate[];
  assignments: AssignmentRecord[];
  gameId: string;
  isActual: boolean;
  players: { id: string; firstName: string; lastNameInitial: string }[];
  onCellTap: (periodNumber: number, slotIndex: number) => void;
}) {
  const playerLabel = (id: string | null) => {
    if (!id) return "—";
    const p = players.find((x) => x.id === id);
    return p ? displayName(p) : "?";
  };

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left px-3 py-2 font-bold text-slate-500">Period</th>
            {slotTemplate.map((s) => (
              <th key={s.index} className="text-left px-3 py-2 font-bold text-slate-500">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
            <tr key={p} className="border-b border-slate-100">
              <td className="px-3 py-2 font-semibold">P{p}</td>
              {slotTemplate.map((slot) => {
                const a = getAssignment(assignments, gameId, p, slot.index, isActual);
                return (
                  <td key={slot.index} className="px-3 py-2 whitespace-nowrap">
                    <button className="min-h-touch" onClick={() => onCellTap(p, slot.index)}>
                      {playerLabel(a?.playerId ?? null)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
