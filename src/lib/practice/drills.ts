import { DrillArchiveRecord, DrillRecord } from "@/lib/offline/DataProvider";

/** A team's usable drill catalog: its own drills plus every library drill it hasn't archived. */
export function visibleDrills(drills: DrillRecord[], drillArchives: DrillArchiveRecord[], teamId: string): DrillRecord[] {
  const archivedLibraryIds = new Set(drillArchives.map((a) => a.drillId));
  return drills.filter((d) => {
    if (d.scope === "library") return !archivedLibraryIds.has(d.id);
    return d.teamId === teamId;
  });
}

export function isDrillArchived(drill: DrillRecord, drillArchives: DrillArchiveRecord[]): boolean {
  if (drill.scope === "library") return drillArchives.some((a) => a.drillId === drill.id);
  return drill.archived;
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
