import { DrillRecord, PracticeBlockRecord, PracticePlanRecord } from "@/lib/offline/DataProvider";
import { focusAreaLabel, FOCUS_AREAS } from "@/lib/practice/constants";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  drill: "Drill",
  break: "Break",
  talk: "Talk",
  free_play: "Free Play",
};

export function blockLabel(block: PracticeBlockRecord, drills: DrillRecord[]): string {
  if (block.drillId) {
    const drill = drills.find((d) => d.id === block.drillId);
    if (drill) return drill.name;
  }
  return BLOCK_TYPE_LABELS[block.type] ?? block.type;
}

export function equipmentChecklist(blocks: PracticeBlockRecord[], drills: DrillRecord[]): string[] {
  const items = new Set<string>();
  for (const block of blocks) {
    if (!block.drillId) continue;
    const drill = drills.find((d) => d.id === block.drillId);
    if (!drill) continue;
    for (const item of drill.equipment) items.add(item);
  }
  return [...items].sort((a, b) => a.localeCompare(b));
}

export function textSummaryFromPracticePlan(
  plan: PracticePlanRecord,
  blocks: PracticeBlockRecord[],
  drills: DrillRecord[]
): string {
  const lines: string[] = [];
  const dateLabel = plan.date
    ? new Date(plan.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "No date set";
  lines.push(`Practice Plan — ${dateLabel}`);
  if (plan.location) lines.push(`Location: ${plan.location}`);
  lines.push(`Target: ${plan.targetMinutes} min`);
  lines.push("");

  let offset = 0;
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  for (const block of sorted) {
    const drill = block.drillId ? drills.find((d) => d.id === block.drillId) : undefined;
    lines.push(`[${offset} min] ${blockLabel(block, drills)} — ${block.plannedMinutes} min`);
    if (drill) {
      if (drill.setup) lines.push(`  Setup: ${drill.setup}`);
      if (drill.instructions) lines.push(`  Instructions: ${drill.instructions}`);
      if (drill.coachingPoints.length > 0) lines.push(`  Coaching points: ${drill.coachingPoints.join("; ")}`);
    }
    offset += block.plannedMinutes;
  }

  const equipment = equipmentChecklist(blocks, drills);
  if (equipment.length > 0) {
    lines.push("");
    lines.push("Equipment:");
    for (const item of equipment) lines.push(`  - ${item}`);
  }

  return lines.join("\n");
}

export interface FocusAreaCoverage {
  area: string;
  label: string;
  minutes: number;
}

/** Minutes-per-focus-area across every drill block in the given plans, for the season coverage chart. Full block duration counts toward every focus area a drill is tagged with. */
export function computeFocusAreaCoverage(
  plans: PracticePlanRecord[],
  blocksByPlan: Map<string, PracticeBlockRecord[]>,
  drills: DrillRecord[]
): FocusAreaCoverage[] {
  const minutesByArea = new Map<string, number>(FOCUS_AREAS.map((a) => [a, 0]));
  for (const plan of plans) {
    const blocks = blocksByPlan.get(plan.id) ?? [];
    for (const block of blocks) {
      if (!block.drillId) continue;
      const drill = drills.find((d) => d.id === block.drillId);
      if (!drill) continue;
      for (const area of drill.focusAreas) {
        minutesByArea.set(area, (minutesByArea.get(area) ?? 0) + block.plannedMinutes);
      }
    }
  }
  return FOCUS_AREAS.map((area) => ({ area, label: focusAreaLabel(area), minutes: minutesByArea.get(area) ?? 0 }));
}
