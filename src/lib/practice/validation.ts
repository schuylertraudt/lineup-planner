import { DrillRecord, PracticeBlockRecord, PracticePlanRecord } from "@/lib/offline/DataProvider";

export interface PracticeWarning {
  id: string;
  message: string;
}

function drillFor(block: PracticeBlockRecord, drills: DrillRecord[]): DrillRecord | undefined {
  return block.drillId ? drills.find((d) => d.id === block.drillId) : undefined;
}

export function computePracticeWarnings(
  plan: Pick<PracticePlanRecord, "targetMinutes">,
  blocks: PracticeBlockRecord[],
  drills: DrillRecord[],
  presentPlayerCount: number
): PracticeWarning[] {
  const warnings: PracticeWarning[] = [];
  const plannedMinutes = blocks.reduce((sum, b) => sum + b.plannedMinutes, 0);

  // Total exceeds target.
  if (plannedMinutes > plan.targetMinutes) {
    warnings.push({
      id: "over-target",
      message: `Planned time (${plannedMinutes} min) is ${plannedMinutes - plan.targetMinutes} min over your ${plan.targetMinutes} min target.`,
    });
  }

  // Any single block eating more than 40% of the session.
  if (plannedMinutes > 0) {
    for (const block of blocks) {
      if (block.plannedMinutes / plannedMinutes > 0.4) {
        const drill = drillFor(block, drills);
        const label = drill ? drill.name : blockTypeLabel(block.type);
        warnings.push({
          id: `block-share:${block.id}`,
          message: `${label} takes up more than 40% of the session (${block.plannedMinutes} of ${plannedMinutes} min).`,
        });
      }
    }
  }

  // Drill scheduled below its own minimum minutes.
  for (const block of blocks) {
    const drill = drillFor(block, drills);
    if (drill?.minMinutes != null && block.plannedMinutes < drill.minMinutes) {
      warnings.push({
        id: `below-min:${block.id}`,
        message: `${drill.name} is scheduled for ${block.plannedMinutes} min, below its ${drill.minMinutes} min minimum.`,
      });
    }
  }

  // No free play / small-sided game block anywhere in the plan.
  const hasFreePlayOrGame = blocks.some((b) => {
    if (b.type === "free_play") return true;
    const drill = drillFor(b, drills);
    return drill?.category === "small_sided_game";
  });
  if (!hasFreePlayOrGame && blocks.length > 0) {
    warnings.push({ id: "no-game-or-free-play", message: "No free play or small-sided game block — consider adding one." });
  }

  // Talk blocks: more than one, or more than 4 minutes combined.
  const talkBlocks = blocks.filter((b) => b.type === "talk");
  const talkMinutes = talkBlocks.reduce((sum, b) => sum + b.plannedMinutes, 0);
  if (talkBlocks.length > 1) {
    warnings.push({ id: "multiple-talks", message: `${talkBlocks.length} talk blocks — keep instructions brief for this age group.` });
  } else if (talkMinutes > 4) {
    warnings.push({ id: "talk-too-long", message: `Talking totals ${talkMinutes} min — keep instructions brief for this age group.` });
  }

  // Drill's minPlayers exceeding how many players are marked present.
  for (const block of blocks) {
    const drill = drillFor(block, drills);
    if (drill?.minPlayers != null && drill.minPlayers > presentPlayerCount) {
      warnings.push({
        id: `not-enough-players:${block.id}`,
        message: `${drill.name} needs at least ${drill.minPlayers} players, but only ${presentPlayerCount} are marked present.`,
      });
    }
  }

  // More than one break on a standard 30-minute plan.
  const breakCount = blocks.filter((b) => b.type === "break").length;
  if (breakCount > 1 && plan.targetMinutes === 30) {
    warnings.push({ id: "multiple-breaks", message: `${breakCount} breaks on a 30-min plan — consider combining them.` });
  }

  return warnings;
}

function blockTypeLabel(type: string): string {
  const labels: Record<string, string> = { drill: "Drill", break: "Break", talk: "Talk", free_play: "Free Play" };
  return labels[type] ?? type;
}
