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
  computeGameWarnings,
  computeSwapSuggestions,
  computeWarningIfAssigned,
  GameWarning,
  SwapSuggestion,
  getAssignment,
  getPeriodAssignments,
} from "@/lib/gameFairness";
import { generatePlan } from "@/lib/autofill";
import { displayName, emptyTotals, PlayerSeasonTotals, SlotTemplate } from "@/lib/types";
import { PlayerPicker, PickerCandidate } from "@/components/PlayerPicker";
import { PositionGroupTally } from "@/components/PositionGroupTally";

export default function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const router = useRouter();
  const { games, players, slots, availabilities, assignments, gamePeriods, mutate, deleteGame, ready } = useData();
  const game = games.find((g) => g.id === gameId);

  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [editingGame, setEditingGame] = useState(false);
  const [editOpponent, setEditOpponent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPeriodCount, setEditPeriodCount] = useState(4);
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
  const gamePlanCounts = useMemo(
    () => computeGamePlanCounts(assignments, gameId, false),
    [assignments, gameId]
  );
  const gamePlanGroupTotals = useMemo(
    () => computeGamePlanGroupTotals(assignments, gameId, slots, false),
    [assignments, gameId, slots]
  );
  const gameWarnings = useMemo(
    () => (game ? computeGameWarnings(assignments, gameId, game.periodCount, false, availablePlayerIds, slots) : []),
    [assignments, gameId, game, availablePlayerIds, slots]
  );
  const swapSuggestions = useMemo(
    () =>
      game
        ? computeSwapSuggestions(assignments, gameId, game.periodCount, false, availablePlayerIds, slots, activePlayers)
        : [],
    [assignments, gameId, game, availablePlayerIds, slots, activePlayers]
  );

  async function applySuggestion(suggestion: SwapSuggestion) {
    for (const change of suggestion.changes) {
      await setAssignment(mutate, gameId, change.periodNumber, change.slotIndex, change.playerId, false);
    }
  }

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
    const periodAssignments = getPeriodAssignments(assignments, gameId, periodNumber, false);
    return availablePlayerIds
      .map((id) => activePlayers.find((p) => p.id === id)!)
      .filter(Boolean)
      .map((player) => ({
        player,
        seasonTotals: seasonTotals[player.id] ?? emptyTotals(),
        gameTotals: gamePlanGroupTotals[player.id] ?? emptyTotals(),
        assignedElsewhereThisPeriod: periodAssignments.some((a) => a.playerId === player.id && a.slotIndex !== excludeSlotIndex),
        resultingWarning: computeWarningIfAssigned(
          assignments,
          gameId,
          periodCount,
          false,
          availablePlayerIds,
          slots,
          periodNumber,
          excludeSlotIndex,
          player.id
        ),
      }));
  }

  async function handleSelectPlayer(periodNumber: number, slotIndex: number, playerId: string) {
    const periodAssignments = getPeriodAssignments(assignments, gameId, periodNumber, false);
    const existingElsewhere = periodAssignments.find((a) => a.playerId === playerId && a.slotIndex !== slotIndex);
    if (existingElsewhere) {
      await setAssignment(mutate, gameId, periodNumber, existingElsewhere.slotIndex, null, false);
    }
    await setAssignment(mutate, gameId, periodNumber, slotIndex, playerId, false);
    setPicker(null);
  }

  async function handleClearSlot(periodNumber: number, slotIndex: number) {
    await setAssignment(mutate, gameId, periodNumber, slotIndex, null, false);
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

  async function handleMarkComplete() {
    const ok = window.confirm(
      "Mark this game complete? This locks in the current plan as the official record for every period and counts it toward season fairness totals."
    );
    if (!ok) return;
    setCompleting(true);
    for (let p = 1; p <= periodCount; p++) {
      for (const slot of slotTemplate) {
        const planned = getAssignment(assignments, gameId, p, slot.index, false)?.playerId ?? null;
        await setAssignment(mutate, gameId, p, slot.index, planned, true);
      }
      await setGamePeriodStatus(mutate, gameId, p, "completed", { completedAt: new Date().toISOString() });
    }
    await updateGame(mutate, gameId, { status: "final" });
    setCompleting(false);
  }

  async function handleClearLineup() {
    const ok = window.confirm(
      "Clear the entire planned lineup for this game? Every period's assignments will be removed. This cannot be undone."
    );
    if (!ok) return;
    setClearing(true);
    for (let p = 1; p <= periodCount; p++) {
      for (const slot of slotTemplate) {
        await setAssignment(mutate, gameId, p, slot.index, null, false);
      }
    }
    setClearing(false);
  }

  async function handleResetToPlanned() {
    const ok = window.confirm(
      "Reset this game back to Planned? This clears the recorded record for every period. Your draft plan is untouched."
    );
    if (!ok) return;
    setResetting(true);
    for (let p = 1; p <= periodCount; p++) {
      for (const slot of slotTemplate) {
        await setAssignment(mutate, gameId, p, slot.index, null, true);
      }
      await setGamePeriodStatus(mutate, gameId, p, "planned");
    }
    await updateGame(mutate, gameId, { status: "planned" });
    setResetting(false);
  }

  function startEditGame() {
    if (!game) return;
    setEditOpponent(game.opponent);
    setEditDate(game.date.slice(0, 10));
    setEditLocation(game.location);
    setEditPeriodCount(game.periodCount);
    setEditingGame(true);
  }

  async function saveEditGame() {
    if (!editOpponent.trim() || !editDate) return;
    await updateGame(mutate, gameId, {
      opponent: editOpponent.trim(),
      date: new Date(editDate).toISOString(),
      location: editLocation,
      periodCount: editPeriodCount || 1,
    });
    setEditingGame(false);
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
      {editingGame ? (
        <div className="card p-4 space-y-3">
          <div>
            <p className="label">Opponent</p>
            <input className="input" value={editOpponent} onChange={(e) => setEditOpponent(e.target.value)} />
          </div>
          <div>
            <p className="label">Date</p>
            <input type="date" className="input" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div>
            <p className="label">Location</p>
            <input className="input" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          </div>
          <div>
            <p className="label">Periods</p>
            <input
              type="number"
              min={1}
              max={12}
              className="input"
              value={editPeriodCount}
              onChange={(e) => setEditPeriodCount(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={!editOpponent.trim() || !editDate} onClick={saveEditGame}>Save</button>
            <button className="btn-secondary" onClick={() => setEditingGame(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">vs {game.opponent}</h1>
              {game.status === "final" && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 shrink-0">Final</span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {new Date(game.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {game.location ? ` · ${game.location}` : ""} · {periodCount} periods
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Link href={`/games/${gameId}/report`} className="btn-secondary text-sm">Report</Link>
            <div className="flex items-center gap-2">
              <button className="text-xs font-semibold text-field min-h-touch px-1" onClick={startEditGame}>Edit</button>
              <button className="text-xs text-red-700 font-semibold min-h-touch px-1" onClick={handleDeleteGame} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete game"}
              </button>
            </div>
          </div>
        </div>
      )}

      {game.status === "final" ? (
        <div className="flex justify-end">
          <button className="text-xs text-red-700 font-semibold min-h-touch px-1" onClick={handleResetToPlanned} disabled={resetting}>
            {resetting ? "Resetting..." : "Reset to Planned"}
          </button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={handleMarkComplete} disabled={completing}>
          {completing ? "Marking complete..." : "Mark Game Complete"}
        </button>
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

      <div className="flex gap-2">
        <button className="btn-secondary flex-1 text-sm" onClick={() => runAutofill(false)}>Auto-fill empty</button>
        <button className="btn-secondary flex-1 text-sm" onClick={() => runAutofill(true)}>Reset &amp; auto-fill</button>
      </div>
      <div className="flex justify-end">
        <button className="text-xs text-red-700 font-semibold min-h-touch px-1" onClick={handleClearLineup} disabled={clearing}>
          {clearing ? "Clearing..." : "Clear lineup"}
        </button>
      </div>

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
          players={activePlayers}
          availablePlayerIds={availablePlayerIds}
          gamePlanCounts={gamePlanCounts}
          gamePlanGroupTotals={gamePlanGroupTotals}
          seasonTotals={seasonTotals}
          gameWarnings={gameWarnings}
          swapSuggestions={swapSuggestions}
          onApplySuggestion={applySuggestion}
          onSlotTap={(slotIndex) => setPicker({ periodNumber: selectedPeriod, slotIndex })}
        />
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
  players,
  availablePlayerIds,
  gamePlanCounts,
  gamePlanGroupTotals,
  seasonTotals,
  gameWarnings,
  swapSuggestions,
  onApplySuggestion,
  onSlotTap,
}: {
  periodNumber: number;
  slotTemplate: SlotTemplate[];
  assignments: AssignmentRecord[];
  gameId: string;
  players: { id: string; firstName: string; lastNameInitial: string; jerseyNumber: string }[];
  availablePlayerIds: string[];
  gameWarnings: GameWarning[];
  swapSuggestions: SwapSuggestion[];
  onApplySuggestion: (suggestion: SwapSuggestion) => void;
  gamePlanCounts: Record<string, number>;
  gamePlanGroupTotals: Record<string, PlayerSeasonTotals>;
  seasonTotals: Record<string, PlayerSeasonTotals>;
  onSlotTap: (slotIndex: number) => void;
}) {
  const [showWarnings, setShowWarnings] = useState(true);
  const [showTotals, setShowTotals] = useState(false);
  const playerById = (id: string | null) => (id ? players.find((p) => p.id === id) : undefined);
  const assignedIds = new Set(
    getPeriodAssignments(assignments, gameId, periodNumber, false)
      .map((a) => a.playerId)
      .filter(Boolean) as string[]
  );
  const bench = availablePlayerIds.filter((id) => !assignedIds.has(id)).map((id) => playerById(id)).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="card divide-y divide-slate-100">
        {slotTemplate.map((slot) => {
          const assignment = getAssignment(assignments, gameId, periodNumber, slot.index, false);
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

      {gameWarnings.length > 0 && (
        <div className="card">
          <button className="w-full flex items-center justify-between p-3 min-h-touch" onClick={() => setShowWarnings((v) => !v)}>
            <span className="font-semibold">Workload warnings ({gameWarnings.length})</span>
            <span className="text-slate-400 text-sm">{showWarnings ? "Hide" : "Show"}</span>
          </button>
          {showWarnings && (
            <div className="border-t border-slate-200 p-3 space-y-2">
              {gameWarnings.map((w) => {
                const player = playerById(w.playerId);
                if (!player) return null;
                return (
                  <div
                    key={w.playerId}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-red-50 border border-red-200"
                  >
                    <span className="font-semibold text-sm">{displayName(player)}</span>
                    <span className="text-xs font-semibold text-red-700">
                      {w.reasons.join(" · ")}
                    </span>
                  </div>
                );
              })}
              {swapSuggestions.length > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Suggested fixes</p>
                  {swapSuggestions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-sky-50 border border-sky-200">
                      <span className="text-sm text-sky-900">{s.description}</span>
                      <button className="btn-secondary !min-h-0 px-2 py-1 text-xs shrink-0" onClick={() => onApplySuggestion(s)}>
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <button className="w-full flex items-center justify-between p-3 min-h-touch" onClick={() => setShowTotals((v) => !v)}>
          <span className="font-semibold">Player totals</span>
          <span className="text-slate-400 text-sm">{showTotals ? "Hide" : "Show"}</span>
        </button>
        {showTotals && (
          <div className="border-t border-slate-200 p-3 divide-y divide-slate-100">
            {availablePlayerIds.map((id) => {
              const player = playerById(id);
              if (!player) return null;
              return (
                <div key={id} className="py-2">
                  <p className="font-semibold text-sm">{displayName(player)}</p>
                  <div className="flex items-center justify-between gap-2">
                    <PositionGroupTally totals={gamePlanGroupTotals[id] ?? emptyTotals()} label="This game" />
                    <PositionGroupTally totals={seasonTotals[id] ?? emptyTotals()} label="Season" />
                  </div>
                </div>
              );
            })}
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
  players,
  onCellTap,
}: {
  periodCount: number;
  slotTemplate: SlotTemplate[];
  assignments: AssignmentRecord[];
  gameId: string;
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
                const a = getAssignment(assignments, gameId, p, slot.index, false);
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
