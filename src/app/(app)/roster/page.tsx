"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/offline/DataProvider";
import { createPlayer, newId, setPlayerActive, updatePlayer } from "@/lib/offline/actions";
import { parseBulkPlayers } from "@/lib/parseBulkPlayers";

export default function RosterPage() {
  const { players, mutate, ready } = useData();
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastNameInitial, setLastNameInitial] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = useMemo(() => players.filter((p) => p.active).sort((a, b) => a.order - b.order), [players]);
  const inactive = useMemo(() => players.filter((p) => !p.active).sort((a, b) => a.order - b.order), [players]);

  async function addPlayer() {
    if (!firstName.trim()) return;
    const maxOrder = players.reduce((m, p) => Math.max(m, p.order), -1);
    await createPlayer(mutate, { firstName: firstName.trim(), lastNameInitial, jerseyNumber, order: maxOrder + 1 });
    setFirstName("");
    setLastNameInitial("");
    setJerseyNumber("");
  }

  async function addBulk() {
    const parsed = parseBulkPlayers(bulkText);
    let maxOrder = players.reduce((m, p) => Math.max(m, p.order), -1);
    for (const p of parsed) {
      maxOrder += 1;
      await mutate("player", newId(), {
        firstName: p.firstName,
        lastNameInitial: p.lastNameInitial,
        jerseyNumber: p.jerseyNumber,
        active: true,
        order: maxOrder,
      });
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
          <input className="input flex-1" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="input w-16" placeholder="L." value={lastNameInitial} onChange={(e) => setLastNameInitial(e.target.value)} maxLength={2} />
          <input className="input w-16" placeholder="#" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} maxLength={3} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={addPlayer}>Add player</button>
          <button className="btn-secondary" onClick={() => setShowBulk((v) => !v)}>Bulk add</button>
        </div>
        {showBulk && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <p className="text-sm text-slate-500">One player per line: name, optional last initial, optional jersey number.</p>
            <textarea
              className="input min-h-[120px]"
              placeholder={"Ava T 7\nBen #4\nCarter"}
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
              <span>
                {p.firstName} {p.lastNameInitial} {p.jerseyNumber && `#${p.jerseyNumber}`}
              </span>
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
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastNameInitial, setLastNameInitial] = useState(player.lastNameInitial);
  const [jerseyNumber, setJerseyNumber] = useState(player.jerseyNumber);

  if (editing) {
    return (
      <div className="card p-3 space-y-2">
        <div className="flex gap-2">
          <input className="input flex-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="input w-16" value={lastNameInitial} onChange={(e) => setLastNameInitial(e.target.value)} maxLength={2} />
          <input className="input w-16" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} maxLength={3} />
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={async () => {
              await updatePlayer(mutate, player.id, { firstName, lastNameInitial, jerseyNumber });
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
      <button className="flex-1 text-left min-h-touch" onClick={onEdit}>
        <span className="font-semibold">
          {player.firstName} {player.lastNameInitial}
        </span>
        {player.jerseyNumber && <span className="text-slate-500 ml-2">#{player.jerseyNumber}</span>}
      </button>
      <button className="btn-secondary text-xs" onClick={onDeactivate}>Deactivate</button>
    </div>
  );
}
