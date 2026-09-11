import { DrillRecord } from "@/lib/offline/DataProvider";
import { DrillInput } from "@/lib/offline/actions";
import { DRILL_CATEGORIES, FOCUS_AREAS } from "@/lib/practice/constants";

export interface DrillJsonEntry {
  name: string;
  category: string;
  focusAreas?: string[];
  defaultMinutes: number;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  equipment?: string[];
  setup?: string;
  instructions?: string;
  coachingPoints?: string[];
  progressions?: string[];
  ageNotes?: string;
}

export function exportTeamDrillsToJson(drills: DrillRecord[]): string {
  const entries: DrillJsonEntry[] = drills
    .filter((d) => d.scope === "team")
    .map((d) => ({
      name: d.name,
      category: d.category,
      focusAreas: d.focusAreas,
      defaultMinutes: d.defaultMinutes,
      minMinutes: d.minMinutes,
      maxMinutes: d.maxMinutes,
      minPlayers: d.minPlayers,
      maxPlayers: d.maxPlayers,
      equipment: d.equipment,
      setup: d.setup,
      instructions: d.instructions,
      coachingPoints: d.coachingPoints,
      progressions: d.progressions,
      ageNotes: d.ageNotes,
    }));
  return JSON.stringify(entries, null, 2);
}

export interface DrillImportError {
  index: number;
  message: string;
}

export interface DrillImportResult {
  valid: DrillInput[];
  errors: DrillImportError[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function parseDrillImport(text: string): DrillImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { valid: [], errors: [{ index: -1, message: "Not valid JSON." }] };
  }
  if (!Array.isArray(data)) {
    return { valid: [], errors: [{ index: -1, message: "Expected a JSON array of drill objects." }] };
  }

  const valid: DrillInput[] = [];
  const errors: DrillImportError[] = [];

  data.forEach((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      errors.push({ index, message: "Not an object." });
      return;
    }
    const entry = raw as Record<string, unknown>;

    if (typeof entry.name !== "string" || !entry.name.trim()) {
      errors.push({ index, message: "Missing or empty \"name\"." });
      return;
    }
    if (typeof entry.category !== "string" || !DRILL_CATEGORIES.includes(entry.category as (typeof DRILL_CATEGORIES)[number])) {
      errors.push({ index, message: `"category" must be one of: ${DRILL_CATEGORIES.join(", ")}.` });
      return;
    }
    if (typeof entry.defaultMinutes !== "number" || !Number.isFinite(entry.defaultMinutes) || entry.defaultMinutes <= 0) {
      errors.push({ index, message: "\"defaultMinutes\" must be a positive number." });
      return;
    }
    if (entry.focusAreas !== undefined && !isStringArray(entry.focusAreas)) {
      errors.push({ index, message: "\"focusAreas\" must be an array of strings." });
      return;
    }
    if (entry.focusAreas && (entry.focusAreas as string[]).some((f) => !FOCUS_AREAS.includes(f as (typeof FOCUS_AREAS)[number]))) {
      errors.push({ index, message: `"focusAreas" entries must be one of: ${FOCUS_AREAS.join(", ")}.` });
      return;
    }
    for (const field of ["equipment", "coachingPoints", "progressions"] as const) {
      if (entry[field] !== undefined && !isStringArray(entry[field])) {
        errors.push({ index, message: `"${field}" must be an array of strings.` });
        return;
      }
    }
    for (const field of ["minMinutes", "maxMinutes", "minPlayers", "maxPlayers"] as const) {
      const v = entry[field];
      if (v !== undefined && v !== null && typeof v !== "number") {
        errors.push({ index, message: `"${field}" must be a number or null.` });
        return;
      }
    }

    valid.push({
      name: entry.name.trim(),
      category: entry.category,
      focusAreas: (entry.focusAreas as string[] | undefined) ?? [],
      defaultMinutes: entry.defaultMinutes,
      minMinutes: (entry.minMinutes as number | null | undefined) ?? null,
      maxMinutes: (entry.maxMinutes as number | null | undefined) ?? null,
      minPlayers: (entry.minPlayers as number | null | undefined) ?? null,
      maxPlayers: (entry.maxPlayers as number | null | undefined) ?? null,
      equipment: (entry.equipment as string[] | undefined) ?? [],
      setup: typeof entry.setup === "string" ? entry.setup : "",
      instructions: typeof entry.instructions === "string" ? entry.instructions : "",
      coachingPoints: (entry.coachingPoints as string[] | undefined) ?? [],
      progressions: (entry.progressions as string[] | undefined) ?? [],
      ageNotes: typeof entry.ageNotes === "string" ? entry.ageNotes : "",
    });
  });

  return { valid, errors };
}
