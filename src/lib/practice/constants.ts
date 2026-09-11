export const DRILL_CATEGORIES = ["warmup", "technical", "small_sided_game", "fun_finisher"] as const;
export type DrillCategory = (typeof DRILL_CATEGORIES)[number];

export const DRILL_CATEGORY_LABELS: Record<DrillCategory, string> = {
  warmup: "Warmup",
  technical: "Technical",
  small_sided_game: "Small-Sided Game",
  fun_finisher: "Fun Finisher",
};

export const FOCUS_AREAS = [
  "dribbling",
  "passing",
  "shooting",
  "defending",
  "first_touch",
  "spatial_awareness",
  "fitness_disguised",
] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  dribbling: "Dribbling",
  passing: "Passing",
  shooting: "Shooting",
  defending: "Defending",
  first_touch: "First Touch",
  spatial_awareness: "Spatial Awareness",
  fitness_disguised: "Fitness (Disguised)",
};

export function categoryLabel(category: string): string {
  return DRILL_CATEGORY_LABELS[category as DrillCategory] ?? category;
}

export function focusAreaLabel(area: string): string {
  return FOCUS_AREA_LABELS[area as FocusArea] ?? area;
}
