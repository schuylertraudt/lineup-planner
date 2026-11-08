"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";
import { switchSeason, updateSeason } from "@/lib/offline/actions";

export default function SeasonsPage() {
  const { team, seasons, currentSeasonId, allPlayers, allGames, mutate, createSeason, ready } = useData();
  const [myRole, setMyRole] = useState<string>("coach");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMyRole(d.coach?.role ?? "coach"))
      .catch(() => {});
  }, []);

  const isOwner = myRole === "owner";
  const sorted = [...seasons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function doCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    const result = await createSeason(newName.trim());
    setCreating(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create season.");
      return;
    }
    setNewName("");
  }

  async function doSwitch(seasonId: string) {
    if (!isOwner || !team) return;
    const ok = window.confirm(
      "Switch the whole team to this season? Every coach will see this season's roster, positions, and games by default."
    );
    if (!ok) return;
    await switchSeason(mutate, team.id, seasonId);
  }

  async function toggleArchived(seasonId: string, archived: boolean) {
    if (!isOwner) return;
    await updateSeason(mutate, seasonId, { archived: !archived });
  }

  function startRename(seasonId: string, currentName: string) {
    setRenamingId(seasonId);
    setRenameDraft(currentName);
  }

  async function saveRename(seasonId: string) {
    if (renameDraft.trim()) {
      await updateSeason(mutate, seasonId, { name: renameDraft.trim() });
    }
    setRenamingId(null);
  }

  if (!ready) return <p className="p-6 text-slate-500">Loading seasons...</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Seasons</h1>
        <Link href="/settings" className="text-sm font-semibold text-field underline">Back to settings</Link>
      </div>

      <div className="space-y-2">
        {sorted.map((s) => {
          const isCurrent = s.id === currentSeasonId;
          const playerCount = allPlayers.filter((p) => p.seasonId === s.id).length;
          const gameCount = allGames.filter((g) => g.seasonId === s.id).length;
          return (
            <div key={s.id} className={`card p-4 space-y-2 ${isCurrent ? "border-field border-2" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                {renamingId === s.id ? (
                  <input
                    className="input flex-1"
                    value={renameDraft}
                    autoFocus
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => saveRename(s.id)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(s.id)}
                  />
                ) : (
                  <button
                    className="font-semibold text-left disabled:text-slate-800"
                    disabled={!isOwner}
                    onClick={() => startRename(s.id, s.name)}
                  >
                    {s.name}
                  </button>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {isCurrent && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-field text-white">Current</span>
                  )}
                  {s.archived && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-600">Archived</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {playerCount} player{playerCount === 1 ? "" : "s"} · {gameCount} game{gameCount === 1 ? "" : "s"}
              </p>
              {isOwner && (
                <div className="flex gap-2 pt-1">
                  {!isCurrent && (
                    <button className="btn-secondary flex-1 text-sm" onClick={() => doSwitch(s.id)}>Switch to this season</button>
                  )}
                  <button className="btn-secondary text-sm" onClick={() => toggleArchived(s.id, s.archived)}>
                    {s.archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isOwner && (
        <div className="card p-4 space-y-3">
          <p className="font-semibold">Start a new season</p>
          <p className="text-sm text-slate-500">
            Creates a season with a blank roster and the standard 8-slot position template, and switches the whole
            team to it right away.
          </p>
          <input
            className="input"
            placeholder="e.g. Spring 2027"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={!newName.trim() || creating} onClick={doCreate}>
            {creating ? "Creating..." : "Create season"}
          </button>
        </div>
      )}
    </div>
  );
}
