import { DrillRecord } from "@/lib/offline/DataProvider";

/** A team's active drill catalog: its own drills, excluding archived ones. */
export function visibleDrills(drills: DrillRecord[], teamId: string): DrillRecord[] {
  return drills.filter((d) => d.teamId === teamId && !d.archived);
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function minutesLabel(drill: Pick<DrillRecord, "defaultMinutes" | "minMinutes" | "maxMinutes">): string {
  if (drill.minMinutes != null && drill.maxMinutes != null && (drill.minMinutes !== drill.defaultMinutes || drill.maxMinutes !== drill.defaultMinutes)) {
    return `${drill.defaultMinutes} min (${drill.minMinutes}-${drill.maxMinutes})`;
  }
  return `${drill.defaultMinutes} min`;
}
