import { emptyTotals, GamePlan, PlayerSeasonTotals, PositionGroup, SlotTemplate } from "./types";

export interface AutofillInput {
  slots: SlotTemplate[];
  periodCount: number;
  /** Available player ids, in stable roster order (used for deterministic tie-breaks). */
  availablePlayerIds: string[];
  /** Season-to-date totals prior to this game (actual assignments only). */
  seasonTotals: Record<string, PlayerSeasonTotals>;
  /**
   * Manual overrides to preserve, period-major (same shape as the returned
   * plan). A non-null cell is treated as already decided and is never
   * touched by the fill or the local-search pass; only null cells are
   * filled in.
   */
  lockedPlan?: GamePlan;
}

interface WorkingState {
  totals: Record<string, PlayerSeasonTotals>;
  lastBenched: Set<string>;
  lastGroup: Map<string, PositionGroup>;
  gkPlayedThisGame: Set<string>;
}

function order(playerIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  playerIds.forEach((id, i) => m.set(id, i));
  return m;
}

/**
 * Deterministic greedy fill, one period at a time, followed by a bounded
 * local-search improvement pass. No randomness: identical inputs always
 * produce identical output.
 */
export function generatePlan(input: AutofillInput): GamePlan {
  const { slots, periodCount, availablePlayerIds, seasonTotals, lockedPlan } = input;
  const rosterOrder = order(availablePlayerIds);

  const working: WorkingState = {
    totals: {},
    lastBenched: new Set(),
    lastGroup: new Map(),
    gkPlayedThisGame: new Set(),
  };
  for (const id of availablePlayerIds) {
    const base = seasonTotals[id] ?? emptyTotals();
    working.totals[id] = { periodsPlayed: base.periodsPlayed, periodsBenched: base.periodsBenched, groups: { ...base.groups }, gkPeriods: base.gkPeriods };
  }

  const plan: GamePlan = [];

  for (let p = 0; p < periodCount; p++) {
    const locked = lockedPlan?.[p] ?? new Array(slots.length).fill(null);
    const periodPlan = fillPeriod(slots, availablePlayerIds, working, rosterOrder, locked);
    plan.push(periodPlan.assignment);
    applyPeriodResult(working, periodPlan, slots);
  }

  return localSearchImprove(plan, input, seasonTotals);
}

interface PeriodFillResult {
  assignment: (string | null)[];
  benched: Set<string>;
  groupBySlot: PositionGroup[];
}

function fillPeriod(
  slots: SlotTemplate[],
  availablePlayerIds: string[],
  working: WorkingState,
  rosterOrder: Map<string, number>,
  locked: (string | null)[] = []
): PeriodFillResult {
  const lockedPlayers = new Set(locked.filter((x): x is string => !!x));
  const openSlotIndexes = slots.map((_, i) => i).filter((i) => !locked[i]);
  const fillablePlayerIds = availablePlayerIds.filter((id) => !lockedPlayers.has(id));

  const benchCount = Math.max(0, fillablePlayerIds.length - openSlotIndexes.length);

  const eligibleToBench = fillablePlayerIds.filter((id) => !working.lastBenched.has(id));
  const sortByMostPlayed = (a: string, b: string) => {
    const diff = working.totals[b].periodsPlayed - working.totals[a].periodsPlayed;
    if (diff !== 0) return diff;
    return (rosterOrder.get(a) ?? 0) - (rosterOrder.get(b) ?? 0);
  };

  let benched: string[] = [];
  if (eligibleToBench.length >= benchCount) {
    benched = [...eligibleToBench].sort(sortByMostPlayed).slice(0, benchCount);
  } else {
    benched = [...eligibleToBench];
    const forced = fillablePlayerIds
      .filter((id) => working.lastBenched.has(id))
      .sort(sortByMostPlayed);
    benched = benched.concat(forced.slice(0, benchCount - benched.length));
  }
  const benchedSet = new Set(benched);
  const playing = fillablePlayerIds.filter((id) => !benchedSet.has(id)).sort((a, b) => (rosterOrder.get(a) ?? 0) - (rosterOrder.get(b) ?? 0));

  const assignment: (string | null)[] = slots.map((_, i) => locked[i] ?? null);
  const groupBySlot: PositionGroup[] = slots.map((s) => s.group);
  const unassigned = new Set(playing);

  const slotOrder = openSlotIndexes.sort((a, b) => {
    const ga = slots[a].group === "GK" ? 0 : 1;
    const gb = slots[b].group === "GK" ? 0 : 1;
    return ga - gb;
  });

  for (const slotIdx of slotOrder) {
    const slot = slots[slotIdx];
    const candidates = [...unassigned];
    if (candidates.length === 0) continue;

    let best: string;
    if (slot.group === "GK") {
      best = candidates.sort((a, b) => {
        const gkDiff = working.totals[a].gkPeriods - working.totals[b].gkPeriods;
        if (gkDiff !== 0) return gkDiff;
        const playedThisGameA = working.gkPlayedThisGame.has(a) ? 1 : 0;
        const playedThisGameB = working.gkPlayedThisGame.has(b) ? 1 : 0;
        if (playedThisGameA !== playedThisGameB) return playedThisGameA - playedThisGameB;
        const playedDiff = working.totals[a].periodsPlayed - working.totals[b].periodsPlayed;
        if (playedDiff !== 0) return playedDiff;
        return (rosterOrder.get(a) ?? 0) - (rosterOrder.get(b) ?? 0);
      })[0];
    } else {
      best = candidates.sort((a, b) => {
        const groupDiff = working.totals[a].groups[slot.group] - working.totals[b].groups[slot.group];
        if (groupDiff !== 0) return groupDiff;
        const consecA = working.lastGroup.get(a) === slot.group ? 1 : 0;
        const consecB = working.lastGroup.get(b) === slot.group ? 1 : 0;
        if (consecA !== consecB) return consecA - consecB;
        const playedDiff = working.totals[a].periodsPlayed - working.totals[b].periodsPlayed;
        if (playedDiff !== 0) return playedDiff;
        return (rosterOrder.get(a) ?? 0) - (rosterOrder.get(b) ?? 0);
      })[0];
    }

    assignment[slotIdx] = best;
    unassigned.delete(best);
  }

  return { assignment, benched: benchedSet, groupBySlot };
}

function applyPeriodResult(working: WorkingState, result: PeriodFillResult, slots: SlotTemplate[]) {
  const playedThisPeriod = new Set<string>();
  result.assignment.forEach((playerId, slotIdx) => {
    if (!playerId) return;
    const group = slots[slotIdx].group;
    working.totals[playerId].periodsPlayed += 1;
    working.totals[playerId].groups[group] += 1;
    if (group === "GK") {
      working.totals[playerId].gkPeriods += 1;
      working.gkPlayedThisGame.add(playerId);
    }
    working.lastGroup.set(playerId, group);
    playedThisPeriod.add(playerId);
  });
  for (const id of result.benched) {
    working.totals[id].periodsBenched += 1;
    working.lastGroup.delete(id);
  }
  working.lastBenched = result.benched;
}

// ---------- Local search improvement ----------

const W_SPREAD = 100000;
const W_CONSEC_BENCH = 10000;
const W_GK = 1000;
const W_GROUP_SPREAD = 100;
const W_CONSEC_GROUP = 10;

function scorePlan(plan: GamePlan, input: AutofillInput): number {
  const { slots, availablePlayerIds, seasonTotals } = input;
  const totals: Record<string, PlayerSeasonTotals> = {};
  for (const id of availablePlayerIds) {
    const base = seasonTotals[id] ?? emptyTotals();
    totals[id] = { periodsPlayed: base.periodsPlayed, periodsBenched: base.periodsBenched, groups: { ...base.groups }, gkPeriods: base.gkPeriods };
  }

  let consecBench = 0;
  let consecGroup = 0;
  let gkViolations = 0;
  const gkPlayedThisGame = new Set<string>();
  let prevBenched = new Set<string>();
  let prevGroup = new Map<string, PositionGroup>();

  for (const periodPlan of plan) {
    const playedThisPeriod = new Set<string>();
    const groupThisPeriod = new Map<string, PositionGroup>();
    periodPlan.forEach((playerId, slotIdx) => {
      if (!playerId) return;
      const group = slots[slotIdx].group;
      playedThisPeriod.add(playerId);
      groupThisPeriod.set(playerId, group);
      if (prevGroup.get(playerId) === group) consecGroup += 1;
      if (group === "GK") {
        if (totals[playerId].gkPeriods > 0) gkViolations += 1;
        if (gkPlayedThisGame.has(playerId)) gkViolations += 1;
        gkPlayedThisGame.add(playerId);
      }
      totals[playerId].periodsPlayed += 1;
      totals[playerId].groups[group] += 1;
      if (group === "GK") totals[playerId].gkPeriods += 1;
    });
    const benchedThisPeriod = new Set(availablePlayerIds.filter((id) => !playedThisPeriod.has(id)));
    for (const id of benchedThisPeriod) {
      if (prevBenched.has(id)) consecBench += 1;
    }
    prevBenched = benchedThisPeriod;
    prevGroup = groupThisPeriod;
  }

  const playedCounts = availablePlayerIds.map((id) => totals[id].periodsPlayed);
  const spread = playedCounts.length > 0 ? Math.max(...playedCounts) - Math.min(...playedCounts) : 0;
  const spreadPenalty = Math.max(0, spread - 1);

  let groupSpreadPenalty = 0;
  for (const id of availablePlayerIds) {
    const g = totals[id].groups;
    const nonGkGroups = [g.D, g.M, g.F];
    groupSpreadPenalty += Math.max(...nonGkGroups) - Math.min(...nonGkGroups);
  }

  return (
    W_SPREAD * spreadPenalty +
    W_CONSEC_BENCH * consecBench +
    W_GK * gkViolations +
    W_GROUP_SPREAD * groupSpreadPenalty +
    W_CONSEC_GROUP * consecGroup
  );
}

function localSearchImprove(
  plan: GamePlan,
  input: AutofillInput,
  seasonTotals: Record<string, PlayerSeasonTotals>
): GamePlan {
  let current = plan.map((p) => [...p]);
  let currentScore = scorePlan(current, input);
  const maxPasses = 3;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let p = 0; p < current.length; p++) {
      const periodPlan = current[p];
      const lockedRow = input.lockedPlan?.[p];
      const isLocked = (i: number) => !!lockedRow?.[i];

      // Move type A: swap two assigned slots within the same period.
      for (let i = 0; i < periodPlan.length; i++) {
        if (isLocked(i)) continue;
        for (let j = i + 1; j < periodPlan.length; j++) {
          if (isLocked(j)) continue;
          if (!periodPlan[i] || !periodPlan[j]) continue;
          if (input.slots[i].group === input.slots[j].group) continue;
          const trial = current.map((pp) => [...pp]);
          [trial[p][i], trial[p][j]] = [trial[p][j], trial[p][i]];
          const trialScore = scorePlan(trial, input);
          if (trialScore < currentScore) {
            current = trial;
            currentScore = trialScore;
            improved = true;
          }
        }
      }

      // Move type B: swap an assigned player with a benched player.
      const benchedIds = input.availablePlayerIds.filter((id) => !periodPlan.includes(id));
      for (let i = 0; i < periodPlan.length; i++) {
        if (isLocked(i)) continue;
        if (!periodPlan[i]) continue;
        for (const benchId of benchedIds) {
          const trial = current.map((pp) => [...pp]);
          trial[p][i] = benchId;
          const trialScore = scorePlan(trial, input);
          if (trialScore < currentScore) {
            current = trial;
            currentScore = trialScore;
            improved = true;
          }
        }
      }
    }

    if (!improved) break;
  }

  return current;
}
