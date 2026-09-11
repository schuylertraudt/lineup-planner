import { DrillRecord } from "@/lib/offline/DataProvider";
import { minutesLabel } from "@/lib/practice/drills";
import { categoryLabel, focusAreaLabel } from "@/lib/practice/constants";

/** The read-only metadata card for a drill: chips, equipment, setup, instructions, coaching points, progressions, age notes. Shared by the drill detail page and the quick-info sheet. */
export function DrillInfoCard({ drill }: { drill: DrillRecord }) {
  return (
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
  );
}
