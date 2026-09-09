"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";
import { createGame } from "@/lib/offline/actions";

function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function SeasonPage() {
  const { games, team, ready, mutate } = useData();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [periodCount, setPeriodCount] = useState(team?.defaultPeriodCount ?? 4);

  const sorted = useMemo(() => [...games].sort((a, b) => a.date.localeCompare(b.date)), [games]);

  async function addGame() {
    if (!opponent.trim()) return;
    const id = await createGame(mutate, {
      date: new Date(date).toISOString(),
      opponent: opponent.trim(),
      location,
      periodCount: periodCount || team?.defaultPeriodCount || 4,
    });
    setOpponent("");
    setLocation("");
    setShowForm(false);
    window.location.href = `/games/${id}`;
  }

  if (!ready) return <p className="p-6 text-slate-500">Loading season...</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Season{team?.seasonLabel ? ` · ${team.seasonLabel}` : ""}</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>+ Game</button>
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Opponent</label>
            <input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Riverside FC" />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Field 3" />
          </div>
          <div>
            <label className="label">Periods</label>
            <input
              type="number"
              min={1}
              max={12}
              className="input"
              value={periodCount}
              onChange={(e) => setPeriodCount(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <button className="btn-primary w-full" onClick={addGame}>Create game</button>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((g) => (
          <Link key={g.id} href={`/games/${g.id}`} className="card p-4 flex items-center justify-between block">
            <div>
              <p className="font-semibold">vs {g.opponent}</p>
              <p className="text-sm text-slate-500">
                {new Date(g.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {g.location ? ` · ${g.location}` : ""}
              </p>
            </div>
            <StatusBadge status={g.status} />
          </Link>
        ))}
        {sorted.length === 0 && <p className="text-slate-500 text-center py-8">No games yet. Add your first game above.</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planned: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-800",
    final: "bg-emerald-100 text-emerald-800",
  };
  const labels: Record<string, string> = { planned: "Planned", in_progress: "Live", final: "Final" };
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles[status] ?? styles.planned}`}>{labels[status] ?? status}</span>;
}
