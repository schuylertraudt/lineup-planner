import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Gives a newly-created team its own editable/deletable copy of every
 * starter drill (the ones seeded by the practice-module migration as
 * scope: "library", teamId: null - a template that's never shown to users
 * directly). Each team gets independent rows from day one, so editing or
 * deleting a starter drill on one team can never affect another.
 */
export async function seedTeamDrillsFromLibrary(teamId: string): Promise<void> {
  const templates = await prisma.drill.findMany({ where: { scope: "library" } });
  if (templates.length === 0) return;

  await prisma.drill.createMany({
    data: templates.map((t) => ({
      id: randomUUID(),
      teamId,
      name: t.name,
      slug: t.slug,
      category: t.category,
      focusAreas: t.focusAreas,
      defaultMinutes: t.defaultMinutes,
      minMinutes: t.minMinutes,
      maxMinutes: t.maxMinutes,
      minPlayers: t.minPlayers,
      maxPlayers: t.maxPlayers,
      equipment: t.equipment,
      setup: t.setup,
      instructions: t.instructions,
      coachingPoints: t.coachingPoints,
      progressions: t.progressions,
      ageNotes: t.ageNotes,
      scope: "team",
      archived: false,
    })),
  });
}
