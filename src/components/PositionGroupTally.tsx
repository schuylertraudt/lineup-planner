import { PlayerSeasonTotals } from "@/lib/types";

export function PositionGroupTally({ totals }: { totals: PlayerSeasonTotals }) {
  return (
    <span className="text-xs text-slate-500 tabular-nums">
      GK {totals.groups.GK} · D {totals.groups.D} · M {totals.groups.M} · F {totals.groups.F}
    </span>
  );
}
