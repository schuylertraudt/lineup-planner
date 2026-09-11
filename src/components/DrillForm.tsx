"use client";

import { useState } from "react";
import { categoryLabel, DRILL_CATEGORIES, focusAreaLabel, FOCUS_AREAS } from "@/lib/practice/constants";
import { DrillInput } from "@/lib/offline/actions";

export interface DrillFormValue {
  name: string;
  category: string;
  focusAreas: string[];
  defaultMinutes: number;
  minMinutes: number | null;
  maxMinutes: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  equipment: string[];
  setup: string;
  instructions: string;
  coachingPoints: string[];
  progressions: string[];
  ageNotes: string;
}

export const BLANK_DRILL_FORM: DrillFormValue = {
  name: "",
  category: "warmup",
  focusAreas: [],
  defaultMinutes: 5,
  minMinutes: null,
  maxMinutes: null,
  minPlayers: null,
  maxPlayers: null,
  equipment: [],
  setup: "",
  instructions: "",
  coachingPoints: [],
  progressions: [],
  ageNotes: "",
};

function OrderedListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <p className="label m-0">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col">
            <button
              type="button"
              className="btn-secondary !min-h-0 !min-w-0 px-2 py-0.5 text-xs"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="btn-secondary !min-h-0 !min-w-0 px-2 py-0.5 text-xs mt-1"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              ▼
            </button>
          </div>
          <span className="flex-1 text-sm bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{item}</span>
          <button type="button" className="btn-danger !min-h-0 px-2 py-1 text-xs" onClick={() => remove(i)}>
            Remove
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-secondary" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export function DrillForm({
  value,
  onChange,
}: {
  value: DrillFormValue;
  onChange: (value: DrillFormValue) => void;
}) {
  function set<K extends keyof DrillFormValue>(key: K, v: DrillFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleFocusArea(area: string) {
    set("focusAreas", value.focusAreas.includes(area) ? value.focusAreas.filter((a) => a !== area) : [...value.focusAreas, area]);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label">Name</p>
        <input className="input" value={value.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div>
        <p className="label">Category</p>
        <select className="input" value={value.category} onChange={(e) => set("category", e.target.value)}>
          {DRILL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="label">Focus areas</p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => toggleFocusArea(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 min-h-touch ${
                value.focusAreas.includes(f) ? "bg-field text-white border-field" : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              {focusAreaLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="label">Default min</p>
          <input
            type="number"
            className="input"
            value={value.defaultMinutes}
            onChange={(e) => set("defaultMinutes", Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <p className="label">Min min</p>
          <input
            type="number"
            className="input"
            value={value.minMinutes ?? ""}
            onChange={(e) => set("minMinutes", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <p className="label">Max min</p>
          <input
            type="number"
            className="input"
            value={value.maxMinutes ?? ""}
            onChange={(e) => set("maxMinutes", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="label">Min players</p>
          <input
            type="number"
            className="input"
            value={value.minPlayers ?? ""}
            onChange={(e) => set("minPlayers", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <p className="label">Max players</p>
          <input
            type="number"
            className="input"
            value={value.maxPlayers ?? ""}
            onChange={(e) => set("maxPlayers", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <p className="label">Equipment (one per line)</p>
        <textarea
          className="input min-h-[80px]"
          value={value.equipment.join("\n")}
          onChange={(e) => set("equipment", e.target.value.split("\n"))}
        />
      </div>

      <div>
        <p className="label">Setup</p>
        <textarea className="input min-h-[60px]" value={value.setup} onChange={(e) => set("setup", e.target.value)} />
      </div>

      <div>
        <p className="label">Instructions</p>
        <textarea className="input min-h-[100px]" value={value.instructions} onChange={(e) => set("instructions", e.target.value)} />
      </div>

      <OrderedListEditor
        label="Coaching points"
        items={value.coachingPoints}
        onChange={(items) => set("coachingPoints", items)}
        placeholder="Add a coaching point"
      />

      <OrderedListEditor
        label="Progressions"
        items={value.progressions}
        onChange={(items) => set("progressions", items)}
        placeholder="Add a progression"
      />

      <div>
        <p className="label">Age notes</p>
        <textarea className="input min-h-[60px]" value={value.ageNotes} onChange={(e) => set("ageNotes", e.target.value)} />
      </div>
    </div>
  );
}

export function drillFormToInput(value: DrillFormValue): DrillInput {
  return {
    name: value.name.trim(),
    category: value.category,
    focusAreas: value.focusAreas,
    defaultMinutes: value.defaultMinutes,
    minMinutes: value.minMinutes,
    maxMinutes: value.maxMinutes,
    minPlayers: value.minPlayers,
    maxPlayers: value.maxPlayers,
    equipment: value.equipment.map((e) => e.trim()).filter(Boolean),
    setup: value.setup,
    instructions: value.instructions,
    coachingPoints: value.coachingPoints,
    progressions: value.progressions,
    ageNotes: value.ageNotes,
  };
}
