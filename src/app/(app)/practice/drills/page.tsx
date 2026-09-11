"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";
import { minutesLabel, visibleDrills } from "@/lib/practice/drills";
import { categoryLabel, DRILL_CATEGORIES, focusAreaLabel, FOCUS_AREAS } from "@/lib/practice/constants";
import { DrillRecord } from "@/lib/offline/DataProvider";

export default function DrillLibraryPage() {
  const { team, drills, ready } = useData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const teamId = team?.id ?? "";

  const filtered = useMemo(() => {
    const base = showArchived ? drills.filter((d) => d.teamId === teamId) : visibleDrills(drills, teamId);
    const q = search.trim().toLowerCase();
    return base
      .filter((d) => (category ? d.category === category : true))
      .filter((d) => (focusArea ? d.focusAreas.includes(focusArea) : true))
      .filter((d) => (q ? d.name.toLowerCase().includes(q) || d.instructions.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drills, teamId, search, category, focusArea, showArchived]);

  if (!ready) {
    return <p className="p-6 text-slate-500">Loading drill library...</p>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Drill Library</h1>
        <div className="flex gap-2 shrink-0">
          <Link href="/practice/drills/import-export" className="btn-secondary text-sm">Import/Export</Link>
          <Link href="/practice/drills/new" className="btn-primary text-sm">+ New Drill</Link>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <input
          className="input"
          placeholder="Search drills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={category === null} onClick={() => setCategory(null)} label="All categories" />
          {DRILL_CATEGORIES.map((c) => (
            <FilterChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)} label={categoryLabel(c)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((f) => (
            <FilterChip key={f} active={focusArea === f} onClick={() => setFocusArea(focusArea === f ? null : f)} label={focusAreaLabel(f)} />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="space-y-2">
        <p className="label">Drills ({filtered.length})</p>
        {filtered.length === 0 && <p className="text-slate-500 text-sm px-1">No drills match.</p>}
        {filtered.map((d) => (
          <DrillRow key={d.id} drill={d} />
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 min-h-touch ${
        active ? "bg-field text-white border-field" : "bg-white text-slate-600 border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

function DrillRow({ drill }: { drill: DrillRecord }) {
  return (
    <Link
      href={`/practice/drills/${drill.id}`}
      className={`card p-3 flex items-center justify-between gap-2 ${drill.archived ? "opacity-50" : ""}`}
    >
      <div className="min-w-0">
        <p className="font-semibold truncate">
          {drill.name}
          {drill.archived && <span className="ml-2 text-xs font-normal text-slate-500">(archived)</span>}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{categoryLabel(drill.category)}</span>
          {drill.focusAreas.slice(0, 2).map((f) => (
            <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{focusAreaLabel(f)}</span>
          ))}
        </div>
      </div>
      <span className="text-sm font-semibold text-slate-500 shrink-0">{minutesLabel(drill)}</span>
    </Link>
  );
}
