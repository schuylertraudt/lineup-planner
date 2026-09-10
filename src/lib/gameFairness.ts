import { AssignmentRecord, AvailabilityRecord, GamePeriodRecord, PlayerRecord, SlotRecord } from "@/lib/offline/DataProvider";
import { displayName, emptyTotals, PlayerSeasonTotals, PositionGroup } from "@/lib/types";

/**
 * Season-to-date totals from ACTUAL (frozen/live) assignments across every
 * game. When `gamePeriods` and `availabilities` are supplied, periodsBenched
 * is also computed: for every completed period, any active/available player
 * without an actual assignment that period is counted as benched.
 */
export function computeSeasonTotals(
  assignments: AssignmentRecord[],
  slots: SlotRecord[],
  gamePeriods: GamePeriodRecord[] = [],
  availabilities: AvailabilityRecord[] = [],
  activePlayerIds: string[] = []
): Record<string, PlayerSeasonTotals> {
  const totals: Record<string, PlayerSeasonTotals> = {};
  const ensure = (id: string) => {
    if (!totals[id]) totals[id] = emptyTotals();
    return totals[id];
  };

  for (const a of assignments) {
    if (!a.isActual || !a.playerId) continue;
    const slot = slots.find((s) => s.order === a.slotIndex);
    if (!slot) continue;
    const t = ensure(a.playerId);
    t.periodsPlayed += 1;
    t.groups[slot.group as PositionGroup] += 1;
    if (slot.group === "GK") t.gkPeriods += 1;
  }

  for (const gp of gamePeriods) {
    if (gp.status !== "completed") continue;
    const absentIds = new Set(
      availabilities.filter((a) => a.gameId === gp.gameId && a.status === "absent").map((a) => a.playerId)
    );
    const playedIds = new Set(
      assignments
        .filter((a) => a.gameId === gp.gameId && a.periodNumber === gp.periodNumber && a.isActual && a.playerId)
        .map((a) => a.playerId as string)
    );
    for (const playerId of activePlayerIds) {
      if (absentIds.has(playerId) || playedIds.has(playerId)) continue;
      ensure(playerId).periodsBenched += 1;
    }
  }

  return totals;
}

/** Periods played in the current game so far (plan or actual layer), per player. */
export function computeGamePlanCounts(
  assignments: AssignmentRecord[],
  gameId: string,
  isActual = false
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of assignments) {
    if (a.gameId !== gameId || a.isActual !== isActual || !a.playerId) continue;
    counts[a.playerId] = (counts[a.playerId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Position-group breakdown of the current game (plan or actual layer) so
 * far, per player — e.g. so the picker can show "GK 1 · D 1 · M 1" for a
 * player already placed in three different periods of the game being
 * edited, not just a bare period count.
 */
export function computeGamePlanGroupTotals(
  assignments: AssignmentRecord[],
  gameId: string,
  slots: SlotRecord[],
  isActual = false
): Record<string, PlayerSeasonTotals> {
  const totals: Record<string, PlayerSeasonTotals> = {};
  for (const a of assignments) {
    if (a.gameId !== gameId || a.isActual !== isActual || !a.playerId) continue;
    const slot = slots.find((s) => s.order === a.slotIndex);
    if (!slot) continue;
    if (!totals[a.playerId]) totals[a.playerId] = emptyTotals();
    const t = totals[a.playerId];
    t.periodsPlayed += 1;
    t.groups[slot.group as PositionGroup] += 1;
    if (slot.group === "GK") t.gkPeriods += 1;
  }
  return totals;
}

/** Longest run of consecutive periods each player is assigned to any slot, in this game/layer. */
export function computeMaxConsecutivePeriods(
  assignments: AssignmentRecord[],
  gameId: string,
  periodCount: number,
  isActual: boolean
): Record<string, number> {
  const playedByPeriod: Set<string>[] = [];
  for (let p = 1; p <= periodCount; p++) {
    playedByPeriod.push(
      new Set(
        assignments
          .filter((a) => a.gameId === gameId && a.periodNumber === p && a.isActual === isActual && a.playerId)
          .map((a) => a.playerId as string)
      )
    );
  }

  const allPlayerIds = new Set<string>();
  playedByPeriod.forEach((set) => set.forEach((id) => allPlayerIds.add(id)));

  const maxStreak: Record<string, number> = {};
  for (const id of allPlayerIds) {
    let current = 0;
    let max = 0;
    for (const periodSet of playedByPeriod) {
      current = periodSet.has(id) ? current + 1 : 0;
      max = Math.max(max, current);
    }
    maxStreak[id] = max;
  }
  return maxStreak;
}

/** Longest run of consecutive periods each available player spends benched (available, but unassigned), in this game/layer. */
export function computeMaxConsecutiveBenchPeriods(
  assignments: AssignmentRecord[],
  gameId: string,
  periodCount: number,
  isActual: boolean,
  availablePlayerIds: string[]
): Record<string, number> {
  const benchedByPeriod: Set<string>[] = [];
  for (let p = 1; p <= periodCount; p++) {
    const playedIds = new Set(
      assignments
        .filter((a) => a.gameId === gameId && a.periodNumber === p && a.isActual === isActual && a.playerId)
        .map((a) => a.playerId as string)
    );
    benchedByPeriod.push(new Set(availablePlayerIds.filter((id) => !playedIds.has(id))));
  }

  const maxStreak: Record<string, number> = {};
  for (const id of availablePlayerIds) {
    let current = 0;
    let max = 0;
    for (const periodSet of benchedByPeriod) {
      current = periodSet.has(id) ? current + 1 : 0;
      max = Math.max(max, current);
    }
    maxStreak[id] = max;
  }
  return maxStreak;
}

/** For each player, the non-GK position group they've been placed in most often this game, and how many times. */
export function computeMaxPositionRepeats(
  assignments: AssignmentRecord[],
  gameId: string,
  slots: SlotRecord[],
  isActual: boolean
): Record<string, { group: PositionGroup; count: number }> {
  const groupTotals = computeGamePlanGroupTotals(assignments, gameId, slots, isActual);
  const result: Record<string, { group: PositionGroup; count: number }> = {};
  for (const [playerId, totals] of Object.entries(groupTotals)) {
    let best: { group: PositionGroup; count: number } = { group: "D", count: 0 };
    for (const group of ["D", "M", "F"] as PositionGroup[]) {
      if (totals.groups[group] > best.count) best = { group, count: totals.groups[group] };
    }
    result[playerId] = best;
  }
  return result;
}

export interface GameWarning {
  playerId: string;
  severity: "yellow" | "red";
  reasons: string[];
}

const GROUP_NAME: Record<PositionGroup, string> = { GK: "GK", D: "defense", M: "midfield", F: "forward" };

/**
 * Workload and variety flags for the game currently being edited. Each
 * check independently escalates a player to yellow or red; red always wins
 * when multiple checks fire, but every triggered reason is listed.
 */
export function computeGameWarnings(
  assignments: AssignmentRecord[],
  gameId: string,
  periodCount: number,
  isActual: boolean,
  availablePlayerIds: string[],
  slots: SlotRecord[]
): GameWarning[] {
  const playedCounts = computeGamePlanCounts(assignments, gameId, isActual);
  const maxPlayStreak = computeMaxConsecutivePeriods(assignments, gameId, periodCount, isActual);
  const maxBenchStreak = computeMaxConsecutiveBenchPeriods(assignments, gameId, periodCount, isActual, availablePlayerIds);
  const maxPositionRepeat = computeMaxPositionRepeats(assignments, gameId, slots, isActual);

  const allPlayerIds = new Set([
    ...Object.keys(playedCounts),
    ...Object.keys(maxPlayStreak),
    ...availablePlayerIds,
  ]);
  const warnings: GameWarning[] = [];

  for (const playerId of allPlayerIds) {
    const played = playedCounts[playerId] ?? 0;
    const playStreak = maxPlayStreak[playerId] ?? 0;
    const benchStreak = maxBenchStreak[playerId] ?? 0;
    const positionRepeat = maxPositionRepeat[playerId] ?? { group: "D" as PositionGroup, count: 0 };
    const reasons: string[] = [];
    let severity: "yellow" | "red" | null = null;

    if (playStreak >= 3) {
      severity = "red";
      reasons.push(`${playStreak} periods in a row`);
    } else if (playStreak === 2) {
      severity = "yellow";
      reasons.push("back-to-back periods");
    }

    if (played > 4) {
      severity = "red";
      reasons.push(`${played} periods this game`);
    } else if (played > 3) {
      if (severity !== "red") severity = "yellow";
      reasons.push(`${played} periods this game`);
    }

    if (benchStreak > 3) {
      severity = "red";
      reasons.push(`benched ${benchStreak} periods in a row`);
    } else if (benchStreak > 2) {
      if (severity !== "red") severity = "yellow";
      reasons.push(`benched ${benchStreak} periods in a row`);
    }

    if (positionRepeat.count >= 3) {
      severity = "red";
      reasons.push(`${GROUP_NAME[positionRepeat.group]} ${positionRepeat.count} times`);
    } else if (positionRepeat.count === 2) {
      if (severity !== "red") severity = "yellow";
      reasons.push(`${GROUP_NAME[positionRepeat.group]} twice`);
    }

    if (severity) warnings.push({ playerId, severity, reasons });
  }

  return warnings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return 0;
  });
}

function warningScore(warnings: GameWarning[]): number {
  return warnings.reduce((sum, w) => sum + (w.severity === "red" ? 100 : 10), 0);
}

function applyVirtualChanges(
  assignments: AssignmentRecord[],
  gameId: string,
  isActual: boolean,
  changes: { periodNumber: number; slotIndex: number; playerId: string | null }[]
): AssignmentRecord[] {
  const result = assignments.map((a) => ({ ...a }));
  for (const change of changes) {
    const existing = result.find(
      (a) =>
        a.gameId === gameId &&
        a.isActual === isActual &&
        a.periodNumber === change.periodNumber &&
        a.slotIndex === change.slotIndex
    );
    if (existing) {
      existing.playerId = change.playerId;
    } else {
      result.push({
        id: `virtual:${gameId}:${change.periodNumber}:${change.slotIndex}:${isActual}`,
        gameId,
        periodNumber: change.periodNumber,
        slotIndex: change.slotIndex,
        playerId: change.playerId,
        isActual,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return result;
}

export interface SwapSuggestion {
  id: string;
  description: string;
  changes: { periodNumber: number; slotIndex: number; playerId: string | null }[];
  scoreBefore: number;
  scoreAfter: number;
}

/**
 * Proposes slot swaps within a single period — either two assigned players
 * trading slots, or an assigned player trading places with someone on the
 * bench — that strictly reduce the total warning score (red=100, yellow=10)
 * with nothing new appearing elsewhere. Never auto-applies; the caller
 * turns `changes` into actual assignment writes only if the coach accepts.
 */
export function computeSwapSuggestions(
  assignments: AssignmentRecord[],
  gameId: string,
  periodCount: number,
  isActual: boolean,
  availablePlayerIds: string[],
  slots: SlotRecord[],
  players: Pick<PlayerRecord, "id" | "firstName" | "lastNameInitial" | "jerseyNumber">[],
  maxSuggestions = 3
): SwapSuggestion[] {
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? displayName(p) : "?";
  };
  const slotByIndex = new Map(slots.map((s) => [s.order, s] as const));

  const baseScore = warningScore(computeGameWarnings(assignments, gameId, periodCount, isActual, availablePlayerIds, slots));
  if (baseScore === 0) return [];

  const candidates: SwapSuggestion[] = [];

  for (let p = 1; p <= periodCount; p++) {
    const assignedBySlot = new Map<number, string>();
    for (const a of assignments) {
      if (a.gameId === gameId && a.periodNumber === p && a.isActual === isActual && a.playerId) {
        assignedBySlot.set(a.slotIndex, a.playerId);
      }
    }
    const assignedPlayerIds = new Set(assignedBySlot.values());
    const benched = availablePlayerIds.filter((id) => !assignedPlayerIds.has(id));
    const slotIndexes = [...assignedBySlot.keys()];

    for (let x = 0; x < slotIndexes.length; x++) {
      for (let y = x + 1; y < slotIndexes.length; y++) {
        const slotA = slotIndexes[x];
        const slotB = slotIndexes[y];
        const playerA = assignedBySlot.get(slotA)!;
        const playerB = assignedBySlot.get(slotB)!;
        const changes = [
          { periodNumber: p, slotIndex: slotA, playerId: playerB },
          { periodNumber: p, slotIndex: slotB, playerId: playerA },
        ];
        const afterScore = warningScore(
          computeGameWarnings(
            applyVirtualChanges(assignments, gameId, isActual, changes),
            gameId,
            periodCount,
            isActual,
            availablePlayerIds,
            slots
          )
        );
        if (afterScore < baseScore) {
          const groupA = slotByIndex.get(slotA)?.name ?? "?";
          const groupB = slotByIndex.get(slotB)?.name ?? "?";
          candidates.push({
            id: `swap:${p}:${slotA}:${slotB}`,
            description: `P${p}: swap ${nameOf(playerA)} (${groupA}) with ${nameOf(playerB)} (${groupB})`,
            changes,
            scoreBefore: baseScore,
            scoreAfter: afterScore,
          });
        }
      }
    }

    for (const slotIdx of slotIndexes) {
      const playerA = assignedBySlot.get(slotIdx)!;
      for (const playerB of benched) {
        const changes = [{ periodNumber: p, slotIndex: slotIdx, playerId: playerB }];
        const afterScore = warningScore(
          computeGameWarnings(
            applyVirtualChanges(assignments, gameId, isActual, changes),
            gameId,
            periodCount,
            isActual,
            availablePlayerIds,
            slots
          )
        );
        if (afterScore < baseScore) {
          const slotName = slotByIndex.get(slotIdx)?.name ?? "?";
          candidates.push({
            id: `bench-swap:${p}:${slotIdx}:${playerB}`,
            description: `P${p}: bench ${nameOf(playerA)}, play ${nameOf(playerB)} at ${slotName}`,
            changes,
            scoreBefore: baseScore,
            scoreAfter: afterScore,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => a.scoreAfter - b.scoreAfter);
  return candidates.slice(0, maxSuggestions);
}

export function getAssignment(
  assignments: AssignmentRecord[],
  gameId: string,
  periodNumber: number,
  slotIndex: number,
  isActual: boolean
): AssignmentRecord | undefined {
  return assignments.find(
    (a) => a.gameId === gameId && a.periodNumber === periodNumber && a.slotIndex === slotIndex && a.isActual === isActual
  );
}

export function getPeriodAssignments(
  assignments: AssignmentRecord[],
  gameId: string,
  periodNumber: number,
  isActual: boolean
): AssignmentRecord[] {
  return assignments.filter((a) => a.gameId === gameId && a.periodNumber === periodNumber && a.isActual === isActual);
}
