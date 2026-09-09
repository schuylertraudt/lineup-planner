import { AssignmentRecord, GameRecord, PlayerRecord, SlotRecord } from "@/lib/offline/DataProvider";
import { displayName, PlayerSeasonTotals } from "@/lib/types";

export { displayName } from "@/lib/types";

export interface ReportPeriodRow {
  periodNumber: number;
  cells: (string | null)[]; // one per slot, player display name or null
  bench: string[];
}

export interface ReportPlayerTotal {
  name: string;
  gamePeriodsPlayed: number;
  gamePositions: string; // "GK 1 · D 2"
  seasonPeriodsPlayed: number;
  seasonDeviation: number;
}

export function buildPeriodGrid(
  game: GameRecord,
  slots: SlotRecord[],
  assignments: AssignmentRecord[],
  players: PlayerRecord[],
  availablePlayerIds: string[]
): ReportPeriodRow[] {
  const rows: ReportPeriodRow[] = [];
  for (let p = 1; p <= game.periodCount; p++) {
    const periodAssignments = assignments.filter((a) => a.gameId === game.id && a.periodNumber === p);
    const actualExists = periodAssignments.some((a) => a.isActual);
    const layerAssignments = periodAssignments.filter((a) => a.isActual === actualExists);

    const cells = slots.map((slot) => {
      const a = layerAssignments.find((x) => x.slotIndex === slot.order);
      if (!a?.playerId) return null;
      const player = players.find((pl) => pl.id === a.playerId);
      return player ? displayName(player) : null;
    });

    const playedIds = new Set(layerAssignments.map((a) => a.playerId).filter(Boolean) as string[]);
    const bench = availablePlayerIds
      .filter((id) => !playedIds.has(id))
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => displayName(p!));

    rows.push({ periodNumber: p, cells, bench });
  }
  return rows;
}

export function csvFromReport(
  game: GameRecord,
  slots: SlotRecord[],
  rows: ReportPeriodRow[],
  playerTotals: ReportPlayerTotal[]
): string {
  const lines: string[] = [];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  lines.push(`Game,${esc(new Date(game.date).toLocaleDateString())}`);
  lines.push(`Opponent,${esc(game.opponent)}`);
  lines.push(`Location,${esc(game.location)}`);
  lines.push(`Periods,${esc(game.periodCount)}`);
  lines.push("");

  lines.push(["Period", ...slots.map((s) => s.name), "Bench"].map(esc).join(","));
  for (const row of rows) {
    lines.push([`P${row.periodNumber}`, ...row.cells.map((c) => c ?? ""), row.bench.join("; ")].map(esc).join(","));
  }

  lines.push("");
  lines.push(["Player", "Game periods", "Game positions", "Season periods", "Season deviation"].map(esc).join(","));
  for (const t of playerTotals) {
    lines.push(
      [t.name, t.gamePeriodsPlayed, t.gamePositions, t.seasonPeriodsPlayed, t.seasonDeviation.toFixed(1)].map(esc).join(",")
    );
  }

  return lines.join("\n");
}

export function textSummaryFromReport(
  game: GameRecord,
  slots: SlotRecord[],
  rows: ReportPeriodRow[],
  playerTotals: ReportPlayerTotal[]
): string {
  const lines: string[] = [];
  lines.push(`${game.opponent} — ${new Date(game.date).toLocaleDateString()}${game.location ? ` @ ${game.location}` : ""}`);
  lines.push("");
  for (const row of rows) {
    lines.push(`Period ${row.periodNumber}:`);
    slots.forEach((slot, i) => {
      lines.push(`  ${slot.name}: ${row.cells[i] ?? "—"}`);
    });
    if (row.bench.length) lines.push(`  Bench: ${row.bench.join(", ")}`);
    lines.push("");
  }
  lines.push("Game totals:");
  for (const t of playerTotals) {
    lines.push(`  ${t.name}: ${t.gamePeriodsPlayed} periods (${t.gamePositions})`);
  }
  lines.push("");
  lines.push("Season to date:");
  for (const t of playerTotals) {
    const dev = t.seasonDeviation > 0 ? `+${t.seasonDeviation.toFixed(1)}` : t.seasonDeviation.toFixed(1);
    lines.push(`  ${t.name}: ${t.seasonPeriodsPlayed} periods (${dev} vs avg)`);
  }
  return lines.join("\n");
}

export interface DivergentPeriod {
  periodNumber: number;
  planned: (string | null)[];
  actual: (string | null)[];
}

/** Periods where the frozen actual assignments differ from what was planned. */
export function findDivergentPeriods(
  game: GameRecord,
  slots: SlotRecord[],
  assignments: AssignmentRecord[],
  players: PlayerRecord[]
): DivergentPeriod[] {
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = players.find((pl) => pl.id === id);
    return p ? displayName(p) : null;
  };

  const divergent: DivergentPeriod[] = [];
  for (let p = 1; p <= game.periodCount; p++) {
    const planned = slots.map(
      (slot) =>
        assignments.find((a) => a.gameId === game.id && a.periodNumber === p && a.slotIndex === slot.order && !a.isActual)
          ?.playerId ?? null
    );
    const actualRows = assignments.filter((a) => a.gameId === game.id && a.periodNumber === p && a.isActual);
    if (actualRows.length === 0) continue;
    const actual = slots.map((slot) => actualRows.find((a) => a.slotIndex === slot.order)?.playerId ?? null);
    const diverges = planned.some((id, i) => id !== actual[i]);
    if (diverges) {
      divergent.push({ periodNumber: p, planned: planned.map(nameOf), actual: actual.map(nameOf) });
    }
  }
  return divergent;
}

export function computeGameTotals(
  game: GameRecord,
  slots: SlotRecord[],
  assignments: AssignmentRecord[]
): Record<string, PlayerSeasonTotals> {
  const totals: Record<string, PlayerSeasonTotals> = {};
  for (let p = 1; p <= game.periodCount; p++) {
    const periodAssignments = assignments.filter((a) => a.gameId === game.id && a.periodNumber === p);
    const actualExists = periodAssignments.some((a) => a.isActual);
    const layer = periodAssignments.filter((a) => a.isActual === actualExists);
    for (const a of layer) {
      if (!a.playerId) continue;
      const slot = slots.find((s) => s.order === a.slotIndex);
      if (!slot) continue;
      if (!totals[a.playerId]) {
        totals[a.playerId] = { periodsPlayed: 0, periodsBenched: 0, groups: { GK: 0, D: 0, M: 0, F: 0 }, gkPeriods: 0 };
      }
      totals[a.playerId].periodsPlayed += 1;
      totals[a.playerId].groups[slot.group as keyof typeof totals[string]["groups"]] += 1;
    }
  }
  return totals;
}

export function gamePositionsSummary(totals: PlayerSeasonTotals): string {
  return `GK ${totals.groups.GK} · D ${totals.groups.D} · M ${totals.groups.M} · F ${totals.groups.F}`;
}
