"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/offline/DataProvider";
import { computeSeasonTotals } from "@/lib/gameFairness";
import { emptyTotals } from "@/lib/types";

type SortKey = "name" | "played" | "benched" | "GK" | "D" | "M" | "F" | "deviation";

export default function FairnessPage() {
  const { players, assignments, slots, gamePeriods, availabilities, ready } = useData();
  const [sortKey, setSortKey] = useState<SortKey>("deviation");
  const [asc, setAsc] = useState(false);

  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);
  const activePlayerIds = useMemo(() => activePlayers.map((p) => p.id), [activePlayers]);
  const totals = useMemo(
    () => computeSeasonTotals(assignments, slots, gamePeriods, availabilities, activePlayerIds),
    [assignments, slots, gamePeriods, availabilities, activePlayerIds]
  );

  const avgPlayed = useMemo(() => {
    if (activePlayers.length === 0) return 0;
    const sum = activePlayers.reduce((s, p) => s + (totals[p.id]?.periodsPlayed ?? 0), 0);
    return sum / activePlayers.length;
  }, [activePlayers, totals]);

  const rows = useMemo(() => {
    return activePlayers.map((p) => {
      const t = totals[p.id] ?? emptyTotals();
      return {
        player: p,
        played: t.periodsPlayed,
        benched: t.periodsBenched,
        groups: t.groups,
        deviation: t.periodsPlayed - avgPlayed,
      };
    });
  }, [activePlayers, totals, avgPlayed]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "name":
          diff = `${a.player.firstName}`.localeCompare(b.player.firstName);
          break;
        case "played":
          diff = a.played - b.played;
          break;
        case "benched":
          diff = a.benched - b.benched;
          break;
        case "GK":
        case "D":
        case "M":
        case "F":
          diff = a.groups[sortKey] - b.groups[sortKey];
          break;
        case "deviation":
          diff = a.deviation - b.deviation;
          break;
      }
      return asc ? diff : -diff;
    });
    return copy;
  }, [rows, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Player" },
    { key: "played", label: "Played" },
    { key: "benched", label: "Benched" },
    { key: "GK", label: "GK" },
    { key: "D", label: "D" },
    { key: "M", label: "M" },
    { key: "F", label: "F" },
    { key: "deviation", label: "±Avg" },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold">Fairness dashboard</h1>
      <p className="text-sm text-slate-500">Season average: {avgPlayed.toFixed(1)} periods played. Tap a column to sort.</p>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-2">
                  <button className="font-bold text-slate-500 min-h-touch" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    {sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.player.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold whitespace-nowrap">
                  {row.player.firstName} {row.player.lastNameInitial}
                </td>
                <td className="px-3 py-2 tabular-nums">{row.played}</td>
                <td className="px-3 py-2 tabular-nums">{row.benched}</td>
                <td className="px-3 py-2 tabular-nums">{row.groups.GK}</td>
                <td className="px-3 py-2 tabular-nums">{row.groups.D}</td>
                <td className="px-3 py-2 tabular-nums">{row.groups.M}</td>
                <td className="px-3 py-2 tabular-nums">{row.groups.F}</td>
                <td className={`px-3 py-2 tabular-nums font-semibold ${Math.abs(row.deviation) >= 1.5 ? "text-red-700" : "text-slate-600"}`}>
                  {row.deviation > 0 ? "+" : ""}
                  {row.deviation.toFixed(1)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                  No completed periods yet this season.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
