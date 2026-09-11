"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/offline/DataProvider";
import { archiveLibraryDrillForTeam, forkDrill, setTeamDrillArchived, unarchiveLibraryDrillForTeam, updateDrill } from "@/lib/offline/actions";
import { isDrillArchived, minutesLabel } from "@/lib/practice/drills";
import { categoryLabel, focusAreaLabel } from "@/lib/practice/constants";
import { DrillForm, drillFormToInput, DrillFormValue } from "@/components/DrillForm";

export default function DrillDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { team, drills, drillArchives, practiceBlocks, coaches, coachId, mutate, deleteDrillPermanently, ready } = useData();
  const drill = drills.find((d) => d.id === params.id);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<DrillFormValue | null>(null);

  const teamId = team?.id ?? "";
  const myRole = coaches.find((c) => c.id === coachId)?.role;
  const referencedCount = useMemo(() => practiceBlocks.filter((b) => b.drillId === params.id).length, [practiceBlocks, params.id]);

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!drill) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <p className="text-slate-500">Drill not found.</p>
        <Link href="/practice/drills" className="btn-secondary inline-block">Back to library</Link>
      </div>
    );
  }

  const isOwnTeamDrill = drill.scope === "team" && drill.teamId === teamId;
  const isLibrary = drill.scope === "library";
  const archived = isDrillArchived(drill, drillArchives);

  function startEdit() {
    if (!drill) return;
    setFormValue({
      name: drill.name,
      category: drill.category,
      focusAreas: drill.focusAreas,
      defaultMinutes: drill.defaultMinutes,
      minMinutes: drill.minMinutes,
      maxMinutes: drill.maxMinutes,
      minPlayers: drill.minPlayers,
      maxPlayers: drill.maxPlayers,
      equipment: drill.equipment,
      setup: drill.setup,
      instructions: drill.instructions,
      coachingPoints: drill.coachingPoints,
      progressions: drill.progressions,
      ageNotes: drill.ageNotes,
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!formValue || !drill) return;
    await updateDrill(mutate, drill.id, { ...drillFormToInput(formValue) });
    setEditing(false);
  }

  async function toggleArchive() {
    if (!drill) return;
    if (isLibrary) {
      if (archived) await unarchiveLibraryDrillForTeam(mutate, teamId, drill.id);
      else await archiveLibraryDrillForTeam(mutate, teamId, drill.id);
    } else {
      await setTeamDrillArchived(mutate, drill.id, !archived);
    }
  }

  async function doFork() {
    if (!drill) return;
    const id = await forkDrill(mutate, drill);
    router.push(`/practice/drills/${id}`);
  }

  async function doDelete() {
    if (!drill) return;
    const result = await deleteDrillPermanently(drill.id);
    if (result.ok) {
      router.push("/practice/drills");
    } else {
      setDeleteError(result.error ?? "Delete failed.");
      setConfirmingDelete(false);
    }
  }

  if (editing && formValue) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <h1 className="text-xl font-bold">Edit Drill</h1>
        <div className="card p-4">
          <DrillForm value={formValue} onChange={setFormValue} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={saveEdit}>Save</button>
          <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{drill.name}</h1>
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">
          {isLibrary ? "Library" : "My Team"}
        </span>
      </div>
      {archived && <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">This drill is archived.</p>}

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{categoryLabel(drill.category)}</span>
          {drill.focusAreas.map((f) => (
            <span key={f} className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{focusAreaLabel(f)}</span>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          <span className="font-semibold">{minutesLabel(drill)}</span>
          {(drill.minPlayers != null || drill.maxPlayers != null) && (
            <span>
              {" · "}
              {drill.minPlayers ?? "?"}
              {drill.maxPlayers != null ? `-${drill.maxPlayers}` : "+"} players
            </span>
          )}
        </p>

        {drill.equipment.length > 0 && (
          <div>
            <p className="label">Equipment</p>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
              {drill.equipment.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {drill.setup && (
          <div>
            <p className="label">Setup</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{drill.setup}</p>
          </div>
        )}

        {drill.instructions && (
          <div>
            <p className="label">Instructions</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{drill.instructions}</p>
          </div>
        )}

        {drill.coachingPoints.length > 0 && (
          <div>
            <p className="label">Coaching points</p>
            <ol className="list-decimal list-inside text-sm text-slate-700 space-y-0.5">
              {drill.coachingPoints.map((c, i) => <li key={i}>{c}</li>)}
            </ol>
          </div>
        )}

        {drill.progressions.length > 0 && (
          <div>
            <p className="label">Progressions</p>
            <ol className="list-decimal list-inside text-sm text-slate-700 space-y-0.5">
              {drill.progressions.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </div>
        )}

        {drill.ageNotes && (
          <div>
            <p className="label">Age notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{drill.ageNotes}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isOwnTeamDrill && <button className="btn-secondary flex-1" onClick={startEdit}>Edit</button>}
        {isLibrary && <button className="btn-secondary flex-1" onClick={doFork}>Fork to customize</button>}
        <button className="btn-secondary flex-1" onClick={toggleArchive}>
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {isOwnTeamDrill && myRole === "owner" && (
        <div className="card p-4 space-y-2 border-red-200">
          <p className="label m-0">Danger zone</p>
          {referencedCount > 0 ? (
            <p className="text-sm text-slate-500">
              This drill is used in {referencedCount} practice plan{referencedCount === 1 ? "" : "s"} and can&apos;t be permanently deleted. Archive it instead.
            </p>
          ) : confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">Permanently delete this drill? This cannot be undone.</p>
              <div className="flex gap-2">
                <button className="btn-danger flex-1" onClick={doDelete}>Yes, delete permanently</button>
                <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>Delete permanently</button>
          )}
          {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}
        </div>
      )}
    </div>
  );
}
