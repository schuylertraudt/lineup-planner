import { AssignmentRecord, AvailabilityRecord, GamePeriodRecord, SlotRecord } from "@/lib/offline/DataProvider";
import { emptyTotals, PlayerSeasonTotals, PositionGroup } from "@/lib/types";

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

/** Periods played in the current game's plan (draft), per player. */
export function computeGamePlanCounts(assignments: AssignmentRecord[], gameId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of assignments) {
    if (a.gameId !== gameId || a.isActual || !a.playerId) continue;
    counts[a.playerId] = (counts[a.playerId] ?? 0) + 1;
  }
  return counts;
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
