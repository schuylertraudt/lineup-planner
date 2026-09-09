"use client";

import { useEffect, useState } from "react";
import { useData } from "@/lib/offline/DataProvider";
import { updateTeamSettings } from "@/lib/offline/actions";
import { PositionGroup } from "@/lib/types";

interface Coach {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const { team, slots, mutate, coachId } = useData();
  const [myRole, setMyRole] = useState<string>("coach");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [name, setName] = useState("");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [defaultPeriodCount, setDefaultPeriodCount] = useState(4);
  const [slotDraft, setSlotDraft] = useState<{ name: string; group: PositionGroup }[]>([]);
  const [resetLink, setResetLink] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMyRole(d.coach?.role ?? "coach"))
      .catch(() => {});
    fetch("/api/team/coaches")
      .then((r) => r.json())
      .then((d) => setCoaches(d.coaches ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setSeasonLabel(team.seasonLabel);
      setDefaultPeriodCount(team.defaultPeriodCount);
      setJoinCode(team.joinCode);
    }
  }, [team]);

  useEffect(() => {
    setSlotDraft([...slots].sort((a, b) => a.order - b.order).map((s) => ({ name: s.name, group: s.group })));
  }, [slots]);

  const isOwner = myRole === "owner";

  async function saveTeamInfo() {
    if (!team) return;
    await updateTeamSettings(mutate, team.id, { name, seasonLabel, defaultPeriodCount });
    setMsg("Saved.");
    setTimeout(() => setMsg(""), 1500);
  }

  async function saveSlots() {
    const res = await fetch("/api/team/slots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: slotDraft, playersOnField: slotDraft.length }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not save position template");
      return;
    }
    setMsg("Position template saved.");
    setTimeout(() => setMsg(""), 1500);
  }

  async function regenerateJoinCode() {
    const ok = window.confirm("Regenerating invalidates the old join code immediately. Continue?");
    if (!ok) return;
    const res = await fetch("/api/team/join-code", { method: "POST" });
    const data = await res.json();
    if (res.ok) setJoinCode(data.joinCode);
  }

  async function removeCoach(id: string) {
    const ok = window.confirm("Remove this coach's access to the team?");
    if (!ok) return;
    const res = await fetch(`/api/team/coaches/${id}`, { method: "DELETE" });
    if (res.ok) setCoaches((prev) => prev.filter((c) => c.id !== id));
  }

  async function triggerReset(id: string) {
    const res = await fetch("/api/team/coaches/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId: id }),
    });
    const data = await res.json();
    if (res.ok) {
      setResetLink(`${window.location.origin}/reset-password?token=${data.token}`);
    }
  }

  function updateSlot(i: number, fields: Partial<{ name: string; group: PositionGroup }>) {
    setSlotDraft((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...fields } : s)));
  }

  function addSlot() {
    setSlotDraft((prev) => [...prev, { name: "D", group: "D" }]);
  }

  function removeSlot(i: number) {
    setSlotDraft((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
      <h1 className="text-xl font-bold">Settings</h1>
      {msg && <p className="text-emerald-700 font-semibold text-sm">{msg}</p>}

      <div className="card p-4 space-y-3">
        <p className="font-semibold">Team info</p>
        <div>
          <label className="label">Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
        </div>
        <div>
          <label className="label">Season label</label>
          <input className="input" value={seasonLabel} onChange={(e) => setSeasonLabel(e.target.value)} disabled={!isOwner} />
        </div>
        <div>
          <label className="label">Default period count</label>
          <input
            type="number"
            min={1}
            max={12}
            className="input"
            value={defaultPeriodCount}
            onChange={(e) => setDefaultPeriodCount(parseInt(e.target.value, 10) || 1)}
            disabled={!isOwner}
          />
        </div>
        {isOwner && <button className="btn-primary w-full" onClick={saveTeamInfo}>Save</button>}
      </div>

      <div className="card p-4 space-y-3">
        <p className="font-semibold">Join code</p>
        <p className="text-3xl font-bold tracking-widest text-center py-2">{joinCode}</p>
        <p className="text-sm text-slate-500">Share this 8-character code with co-coaches so they can join the team.</p>
        {isOwner && <button className="btn-secondary w-full" onClick={regenerateJoinCode}>Regenerate join code</button>}
      </div>

      <div className="card p-4 space-y-3">
        <p className="font-semibold">Coaches</p>
        {coaches.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-1">
            <div>
              <p className="font-medium">{c.name} {c.id === coachId && <span className="text-xs text-slate-400">(you)</span>}</p>
              <p className="text-xs text-slate-500">{c.email} · {c.role}</p>
            </div>
            {isOwner && c.id !== coachId && (
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={() => triggerReset(c.id)}>Reset password</button>
                <button className="btn-danger text-xs" onClick={() => removeCoach(c.id)}>Remove</button>
              </div>
            )}
          </div>
        ))}
        {resetLink && (
          <div className="border-t border-slate-200 pt-3 mt-2 space-y-1">
            <p className="text-sm font-semibold">One-time reset link (valid 1 hour):</p>
            <p className="text-xs break-all bg-slate-100 rounded p-2">{resetLink}</p>
            <p className="text-xs text-slate-500">Send this to the coach yourself — the app does not email it.</p>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="card p-4 space-y-3">
          <p className="font-semibold">Position slots (must total field size)</p>
          {slotDraft.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input flex-1" value={s.name} onChange={(e) => updateSlot(i, { name: e.target.value })} />
              <select className="input w-24" value={s.group} onChange={(e) => updateSlot(i, { group: e.target.value as PositionGroup })}>
                <option value="GK">GK</option>
                <option value="D">D</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
              <button className="btn-danger text-xs" onClick={() => removeSlot(i)}>✕</button>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={addSlot}>+ Slot</button>
            <button className="btn-primary flex-1" onClick={saveSlots}>Save ({slotDraft.length} on field)</button>
          </div>
        </div>
      )}
    </div>
  );
}
