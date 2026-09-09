"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/offline/DataProvider";
import { computeSeasonTotals } from "@/lib/gameFairness";
import {
  buildPeriodGrid,
  computeGameTotals,
  csvFromReport,
  displayName,
  findDivergentPeriods,
  gamePositionsSummary,
  ReportPlayerTotal,
  textSummaryFromReport,
} from "@/lib/report";
import { emptyTotals } from "@/lib/types";

export default function GameReportPage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const { games, players, slots, assignments, availabilities, gamePeriods, ready } = useData();
  const game = games.find((g) => g.id === gameId);
  const [copyStatus, setCopyStatus] = useState("");

  const sortedSlots = useMemo(() => [...slots].sort((a, b) => a.order - b.order), [slots]);
  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);

  const availablePlayerIds = useMemo(() => {
    if (!game) return [];
    const absent = new Set(
      availabilities.filter((a) => a.gameId === gameId && a.status === "absent").map((a) => a.playerId)
    );
    return activePlayers.filter((p) => !absent.has(p.id)).map((p) => p.id);
  }, [activePlayers, availabilities, gameId, game]);

  const rows = useMemo(
    () => (game ? buildPeriodGrid(game, sortedSlots, assignments, players, availablePlayerIds) : []),
    [game, sortedSlots, assignments, players, availablePlayerIds]
  );

  const gameTotals = useMemo(() => (game ? computeGameTotals(game, sortedSlots, assignments) : {}), [game, sortedSlots, assignments]);
  const seasonTotals = useMemo(
    () => computeSeasonTotals(assignments, slots, gamePeriods, availabilities, activePlayers.map((p) => p.id)),
    [assignments, slots, gamePeriods, availabilities, activePlayers]
  );
  const seasonAvg = useMemo(() => {
    if (activePlayers.length === 0) return 0;
    const sum = activePlayers.reduce((s, p) => s + (seasonTotals[p.id]?.periodsPlayed ?? 0), 0);
    return sum / activePlayers.length;
  }, [activePlayers, seasonTotals]);

  const playerTotals: ReportPlayerTotal[] = useMemo(() => {
    return availablePlayerIds
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => {
        const gt = gameTotals[p!.id] ?? emptyTotals();
        const st = seasonTotals[p!.id] ?? emptyTotals();
        return {
          name: displayName(p!),
          gamePeriodsPlayed: gt.periodsPlayed,
          gamePositions: gamePositionsSummary(gt),
          seasonPeriodsPlayed: st.periodsPlayed,
          seasonDeviation: st.periodsPlayed - seasonAvg,
        };
      });
  }, [availablePlayerIds, players, gameTotals, seasonTotals, seasonAvg]);

  const divergent = useMemo(
    () => (game ? findDivergentPeriods(game, sortedSlots, assignments, players) : []),
    [game, sortedSlots, assignments, players]
  );

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!game) return <p className="p-6 text-slate-500">Game not found.</p>;

  function downloadCsv() {
    const csv = csvFromReport(game!, sortedSlots, rows, playerTotals);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-${game!.date.slice(0, 10)}-vs-${game!.opponent.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText() {
    const text = textSummaryFromReport(game!, sortedSlots, rows, playerTotals);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied!");
    } catch {
      setCopyStatus("Copy failed — select and copy manually.");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
        <button className="btn-secondary" onClick={downloadCsv}>Download CSV</button>
        <button className="btn-secondary" onClick={copyText}>Copy as text</button>
        {copyStatus && <span className="text-sm text-emerald-700 font-semibold self-center">{copyStatus}</span>}
      </div>

      <div className="card p-4 space-y-1">
        <h1 className="text-xl font-bold">vs {game.opponent}</h1>
        <p className="text-slate-500">
          {new Date(game.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          {game.location ? ` · ${game.location}` : ""} · {game.periodCount} periods
        </p>
      </div>

      {divergent.length > 0 && (
        <div className="card p-4 space-y-2 border-amber-300 bg-amber-50">
          <p className="font-bold text-amber-800">Planned vs. actual differs in {divergent.length} period{divergent.length === 1 ? "" : "s"}</p>
          {divergent.map((d) => (
            <div key={d.periodNumber} className="text-sm text-amber-900">
              <span className="font-semibold">Period {d.periodNumber}:</span>{" "}
              {sortedSlots.map((slot, i) =>
                d.planned[i] !== d.actual[i] ? (
                  <span key={slot.id} className="mr-2">
                    {slot.name} planned {d.planned[i] ?? "—"} → actual {d.actual[i] ?? "—"}
                  </span>
                ) : null
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-3 py-2 font-bold">Period</th>
              {sortedSlots.map((s) => (
                <th key={s.id} className="text-left px-3 py-2 font-bold">{s.name}</th>
              ))}
              <th className="text-left px-3 py-2 font-bold">Bench</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.periodNumber} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold">P{row.periodNumber}</td>
                {row.cells.map((c, i) => (
                  <td key={i} className="px-3 py-2 whitespace-nowrap">{c ?? "—"}</td>
                ))}
                <td className="px-3 py-2 text-slate-500">{row.bench.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-3 py-2 font-bold">Player</th>
              <th className="text-left px-3 py-2 font-bold">Game periods</th>
              <th className="text-left px-3 py-2 font-bold">Game positions</th>
              <th className="text-left px-3 py-2 font-bold">Season periods</th>
              <th className="text-left px-3 py-2 font-bold">±Avg</th>
            </tr>
          </thead>
          <tbody>
            {playerTotals.map((t) => (
              <tr key={t.name} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{t.name}</td>
                <td className="px-3 py-2">{t.gamePeriodsPlayed}</td>
                <td className="px-3 py-2 whitespace-nowrap">{t.gamePositions}</td>
                <td className="px-3 py-2">{t.seasonPeriodsPlayed}</td>
                <td className="px-3 py-2">{t.seasonDeviation > 0 ? "+" : ""}{t.seasonDeviation.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
