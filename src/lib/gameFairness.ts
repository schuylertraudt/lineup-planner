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

type FlagSeverity = "none" | "yellow" | "red";
const SEVERITY_RANK: Record<FlagSeverity, number> = { none: 0, yellow: 1, red: 2 };

export type FlagCategory = "playStreak" | "totalPlayed" | "benchStreak" | "positionRepeat";

interface CategoryFlag {
  category: FlagCategory;
  severity: FlagSeverity;
  text: string;
}

/**
 * The four independent workload/variety checks for one player, each
 * resolved on its own scale (none/yellow/red) with fixed category keys so
 * before/after states can be compared category-by-category rather than by
 * matching display text (which embeds counts that change even when a
 * category's severity doesn't — e.g. "benched 4 in a row" improving to
 * "benched 3 in a row" is still the same still-flagged category, not a new
 * problem).
 */
function classifyPlayerFlags(
  playedCounts: Record<string, number>,
  maxPlayStreak: Record<string, number>,
  maxBenchStreak: Record<string, number>,
  maxPositionRepeat: Record<string, { group: PositionGroup; count: number }>,
  playerId: string
): CategoryFlag[] {
  const played = playedCounts[playerId] ?? 0;
  const playStreak = maxPlayStreak[playerId] ?? 0;
  const benchStreak = maxBenchStreak[playerId] ?? 0;
  const positionRepeat = maxPositionRepeat[playerId] ?? { group: "D" as PositionGroup, count: 0 };

  const flags: CategoryFlag[] = [];

  if (playStreak >= 3) {
    flags.push({ category: "playStreak", severity: "red", text: `${playStreak} periods in a row` });
  } else if (playStreak === 2) {
    flags.push({ category: "playStreak", severity: "yellow", text: "back-to-back periods" });
  } else {
    flags.push({ category: "playStreak", severity: "none", text: "" });
  }

  if (played > 4) {
    flags.push({ category: "totalPlayed", severity: "red", text: `${played} periods this game` });
  } else if (played > 3) {
    flags.push({ category: "totalPlayed", severity: "yellow", text: `${played} periods this game` });
  } else {
    flags.push({ category: "totalPlayed", severity: "none", text: "" });
  }

  if (benchStreak > 3) {
    flags.push({ category: "benchStreak", severity: "red", text: `benched ${benchStreak} periods in a row` });
  } else if (benchStreak > 2) {
    flags.push({ category: "benchStreak", severity: "yellow", text: `benched ${benchStreak} periods in a row` });
  } else {
    flags.push({ category: "benchStreak", severity: "none", text: "" });
  }

  if (positionRepeat.count >= 3) {
    flags.push({
      category: "positionRepeat",
      severity: "red",
      text: `${GROUP_NAME[positionRepeat.group]} ${positionRepeat.count} times`,
    });
  } else if (positionRepeat.count === 2) {
    flags.push({ category: "positionRepeat", severity: "yellow", text: `${GROUP_NAME[positionRepeat.group]} twice` });
  } else {
    flags.push({ category: "positionRepeat", severity: "none", text: "" });
  }

  return flags;
}

function buildInputs(
  assignments: AssignmentRecord[],
  gameId: string,
  periodCount: number,
  isActual: boolean,
  availablePlayerIds: string[],
  slots: SlotRecord[]
) {
  return {
    playedCounts: computeGamePlanCounts(assignments, gameId, isActual),
    maxPlayStreak: computeMaxConsecutivePeriods(assignments, gameId, periodCount, isActual),
    maxBenchStreak: computeMaxConsecutiveBenchPeriods(assignments, gameId, periodCount, isActual, availablePlayerIds),
    maxPositionRepeat: computeMaxPositionRepeats(assignments, gameId, slots, isActual),
  };
}

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
  const inputs = buildInputs(assignments, gameId, periodCount, isActual, availablePlayerIds, slots);
  const allPlayerIds = new Set([
    ...Object.keys(inputs.playedCounts),
    ...Object.keys(inputs.maxPlayStreak),
    ...availablePlayerIds,
  ]);
  const warnings: GameWarning[] = [];

  for (const playerId of allPlayerIds) {
    const flags = classifyPlayerFlags(
      inputs.playedCounts,
      inputs.maxPlayStreak,
      inputs.maxBenchStreak,
      inputs.maxPositionRepeat,
      playerId
    ).filter((f) => f.severity !== "none");
    if (flags.length === 0) continue;

    const severity: "yellow" | "red" = flags.some((f) => f.severity === "red") ? "red" : "yellow";
    warnings.push({ playerId, severity, reasons: flags.map((f) => f.text) });
  }

  return warnings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return 0;
  });
}

function warningScore(warnings: GameWarning[]): number {
  return warnings.reduce((sum, w) => sum + (w.severity === "red" ? 100 : 10), 0);
}

export function applyVirtualChanges(
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

/**
 * What NEW or worsened warning (if any) placing this player in this
 * slot/period would cause, compared to their current state without that
 * change — for flagging a candidate in the assignment picker before the
 * coach commits to them. Compares category-by-category (play streak, total
 * played, bench streak, position repeat) rather than by matching display
 * text, since text embeds counts that shift even when a category's
 * severity doesn't improve (e.g. "benched 4 in a row" easing to "benched 3
 * in a row" is still the same already-flagged category, not a new
 * problem) — and conversely surfaces a category escalating from yellow to
 * red as new, even though some text would otherwise overlap.
 */
export function computeWarningIfAssigned(
  assignments: AssignmentRecord[],
  gameId: string,
  periodCount: number,
  isActual: boolean,
  availablePlayerIds: string[],
  slots: SlotRecord[],
  periodNumber: number,
  slotIndex: number,
  playerId: string
): GameWarning | undefined {
  const before = buildInputs(assignments, gameId, periodCount, isActual, availablePlayerIds, slots);
  const beforeFlags = classifyPlayerFlags(
    before.playedCounts,
    before.maxPlayStreak,
    before.maxBenchStreak,
    before.maxPositionRepeat,
    playerId
  );

  const virtual = applyVirtualChanges(assignments, gameId, isActual, [{ periodNumber, slotIndex, playerId }]);
  const after = buildInputs(virtual, gameId, periodCount, isActual, availablePlayerIds, slots);
  const afterFlags = classifyPlayerFlags(
    after.playedCounts,
    after.maxPlayStreak,
    after.maxBenchStreak,
    after.maxPositionRepeat,
    playerId
  );

  const newReasons: string[] = [];
  let severity: FlagSeverity = "none";
  for (let i = 0; i < afterFlags.length; i++) {
    if (SEVERITY_RANK[afterFlags[i].severity] > SEVERITY_RANK[beforeFlags[i].severity]) {
      newReasons.push(afterFlags[i].text);
      if (SEVERITY_RANK[afterFlags[i].severity] > SEVERITY_RANK[severity]) severity = afterFlags[i].severity;
    }
  }

  if (newReasons.length === 0 || severity === "none") return undefined;
  return { playerId, severity, reasons: newReasons };
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
