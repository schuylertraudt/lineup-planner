"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/offline/DataProvider";
import { createPlayer, newId, setPlayerActive, updatePlayer } from "@/lib/offline/actions";
import { displayName } from "@/lib/types";

export default function RosterPage() {
  const { players, mutate, ready } = useData();
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = useMemo(() => players.filter((p) => p.active).sort((a, b) => a.order - b.order), [players]);
  const inactive = useMemo(() => players.filter((p) => !p.active).sort((a, b) => a.order - b.order), [players]);

  async function addPlayer() {
    if (!name.trim()) return;
    const maxOrder = players.reduce((m, p) => Math.max(m, p.order), -1);
    await createPlayer(mutate, { firstName: name.trim(), order: maxOrder + 1 });
    setName("");
  }

  async function addBulk() {
    const names = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    let maxOrder = players.reduce((m, p) => Math.max(m, p.order), -1);
    for (const n of names) {
      maxOrder += 1;
      await mutate("player", newId(), { firstName: n, active: true, order: maxOrder });
    }
    setBulkText("");
    setShowBulk(false);
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = active.findIndex((p) => p.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= active.length) return;
    const a = active[idx];
    const b = active[swapIdx];
    await updatePlayer(mutate, a.id, { order: b.order });
    await updatePlayer(mutate, b.id, { order: a.order });
  }

  if (!ready) {
    return <p className="p-6 text-slate-500">Loading roster...</p>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold">Roster</h1>

      <div className="card p-4 space-y-3">
        <p className="label m-0">Add a player</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPlayer();
            }}
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={addPlayer}>Add player</button>
          <button className="btn-secondary" onClick={() => setShowBulk((v) => !v)}>Bulk add</button>
        </div>
        {showBulk && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <p className="text-sm text-slate-500">One player name per line.</p>
            <textarea
              className="input min-h-[120px]"
              placeholder={"Ava\nBen\nCarter"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <button className="btn-primary w-full" onClick={addBulk}>Add all</button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {active.map((p, i) => (
          <PlayerRow
            key={p.id}
            player={p}
            editing={editingId === p.id}
            onEdit={() => setEditingId(p.id)}
            onDone={() => setEditingId(null)}
            onMoveUp={i > 0 ? () => move(p.id, -1) : undefined}
            onMoveDown={i < active.length - 1 ? () => move(p.id, 1) : undefined}
            onDeactivate={() => setPlayerActive(mutate, p.id, false)}
          />
        ))}
        {active.length === 0 && <p className="text-slate-500 text-center py-8">No active players yet. Add your roster above.</p>}
      </div>

      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="label">Inactive players</p>
          {inactive.map((p) => (
            <div key={p.id} className="card p-3 flex items-center justify-between opacity-60">
              <span>{displayName(p)}</span>
              <button className="btn-secondary" onClick={() => setPlayerActive(mutate, p.id, true)}>
                Reactivate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  editing,
  onEdit,
  onDone,
  onMoveUp,
  onMoveDown,
  onDeactivate,
}: {
  player: { id: string; firstName: string; lastNameInitial: string; jerseyNumber: string };
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDeactivate: () => void;
}) {
  const { mutate } = useData();
  const [name, setName] = useState(displayName(player));

  if (editing) {
    return (
      <div className="card p-3 space-y-2">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              await updatePlayer(mutate, player.id, { firstName: name, lastNameInitial: "", jerseyNumber: "" });
              onDone();
            }
          }}
        />
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={async () => {
              await updatePlayer(mutate, player.id, { firstName: name, lastNameInitial: "", jerseyNumber: "" });
              onDone();
            }}
          >
            Save
          </button>
          <button className="btn-secondary" onClick={onDone}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-3 flex items-center gap-2">
      <div className="flex flex-col">
        <button className="btn-secondary !min-h-0 !min-w-0 px-2 py-0.5 text-xs" disabled={!onMoveUp} onClick={onMoveUp}>▲</button>
        <button className="btn-secondary !min-h-0 !min-w-0 px-2 py-0.5 text-xs mt-1" disabled={!onMoveDown} onClick={onMoveDown}>▼</button>
      </div>
      <button className="flex-1 text-left min-h-touch font-semibold" onClick={onEdit}>
        {displayName(player)}
      </button>
      <button className="btn-secondary text-xs" onClick={onDeactivate}>Deactivate</button>
    </div>
  );
}
