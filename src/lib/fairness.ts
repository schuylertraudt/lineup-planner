import { PlayerSeasonTotals, PositionGroup, emptyTotals } from "./types";

export interface RawAssignmentRow {
  playerId: string | null;
  group: PositionGroup;
}

/**
 * Aggregate a flat list of "actual" assignment rows (one row per filled slot
 * per period, across every completed period of every game) into per-player
 * season totals. Bench periods are not represented as rows here; callers
 * that need periodsBenched must pass the count of periods a player was
 * available-but-unassigned via `benchedCounts`.
 */
export function aggregateSeasonTotals(
  rows: RawAssignmentRow[],
  benchedCounts: Record<string, number> = {}
): Record<string, PlayerSeasonTotals> {
  const totals: Record<string, PlayerSeasonTotals> = {};

  for (const row of rows) {
    if (!row.playerId) continue;
    if (!totals[row.playerId]) totals[row.playerId] = emptyTotals();
    const t = totals[row.playerId];
    t.periodsPlayed += 1;
    t.groups[row.group] += 1;
    if (row.group === "GK") t.gkPeriods += 1;
  }

  for (const [playerId, count] of Object.entries(benchedCounts)) {
    if (!totals[playerId]) totals[playerId] = emptyTotals();
    totals[playerId].periodsBenched += count;
  }

  return totals;
}

export interface FairnessDashboardRow {
  playerId: string;
  periodsPlayed: number;
  periodsBenched: number;
  groups: Record<PositionGroup, number>;
  deviationFromAverage: number;
}

export function buildDashboardRows(
  playerIds: string[],
  totals: Record<string, PlayerSeasonTotals>
): FairnessDashboardRow[] {
  const withTotals = playerIds.map((id) => totals[id] ?? emptyTotals());
  const avgPlayed =
    withTotals.reduce((sum, t) => sum + t.periodsPlayed, 0) / (withTotals.length || 1);

  return playerIds.map((playerId, i) => {
    const t = withTotals[i];
    return {
      playerId,
      periodsPlayed: t.periodsPlayed,
      periodsBenched: t.periodsBenched,
      groups: t.groups,
      deviationFromAverage: t.periodsPlayed - avgPlayed,
    };
  });
}

export function cloneTotals(t: PlayerSeasonTotals): PlayerSeasonTotals {
  return {
    periodsPlayed: t.periodsPlayed,
    periodsBenched: t.periodsBenched,
    groups: { ...t.groups },
    gkPeriods: t.gkPeriods,
  };
}
