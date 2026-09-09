import { PlayerSeasonTotals } from "@/lib/types";

export function PositionGroupTally({ totals, label }: { totals: PlayerSeasonTotals; label?: string }) {
  return (
    <span className="text-xs text-slate-500 tabular-nums">
      {label && <span className="text-slate-400">{label} </span>}
      GK {totals.groups.GK} · D {totals.groups.D} · M {totals.groups.M} · F {totals.groups.F}
    </span>
  );
}
