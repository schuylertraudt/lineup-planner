import { prisma } from "../db";
import { Mutation } from "./types";
import { mergeFieldsLWW } from "./merge";

const ALLOWED_FIELDS: Record<Mutation["entity"], string[]> = {
  player: ["firstName", "lastNameInitial", "jerseyNumber", "active", "order"],
  game: ["date", "opponent", "location", "periodCount", "status", "notes"],
  availability: ["status", "gameId", "playerId"],
  assignment: ["playerId", "gameId", "periodNumber", "slotIndex", "isActual", "updatedByCoachId"],
  gamePeriod: ["status", "startedAt", "completedAt", "gameId", "periodNumber"],
  team: ["name", "seasonLabel", "playersOnField", "defaultPeriodCount", "targetMinutes"],
  drill: [
    "name",
    "slug",
    "category",
    "focusAreas",
    "defaultMinutes",
    "minMinutes",
    "maxMinutes",
    "minPlayers",
    "maxPlayers",
    "equipment",
    "setup",
    "instructions",
    "coachingPoints",
    "progressions",
    "ageNotes",
    "sourceDrillId",
    "archived",
  ],
  drillArchive: ["teamId", "drillId"],
  practicePlan: ["date", "location", "targetMinutes", "status", "notes", "isTemplate", "templateName"],
  practiceBlock: ["planId", "order", "type", "drillId", "plannedMinutes", "blockNotes"],
  practiceAttendance: ["planId", "playerId", "status"],
};

function pickAllowed(entity: Mutation["entity"], fields: Record<string, unknown>) {
  const allowed = ALLOWED_FIELDS[entity];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) out[key] = fields[key];
  }
  return out;
}

export class SyncAuthError extends Error {}

export async function applyMutation(mutation: Mutation, teamId: string, coachId: string) {
  if (mutation.op === "delete") {
    if (mutation.entity !== "drillArchive") {
      throw new SyncAuthError(`delete not supported for ${mutation.entity}`);
    }
    await prisma.drillArchive.deleteMany({ where: { id: mutation.entityId, teamId } });
    return null;
  }

  const fields = pickAllowed(mutation.entity, mutation.fields);

  switch (mutation.entity) {
    case "player":
      return applyPlayer(mutation, fields, teamId);
    case "game":
      return applyGame(mutation, fields, teamId);
    case "availability":
      return applyAvailability(mutation, fields, teamId);
    case "assignment":
      return applyAssignment(mutation, fields, teamId, coachId);
    case "gamePeriod":
      return applyGamePeriod(mutation, fields, teamId);
    case "team":
      return applyTeam(mutation, fields, teamId);
    case "drill":
      return applyDrill(mutation, fields, teamId, coachId);
    case "drillArchive":
      return applyDrillArchive(mutation, fields, teamId);
    case "practicePlan":
      return applyPracticePlan(mutation, fields, teamId);
    case "practiceBlock":
      return applyPracticeBlock(mutation, fields, teamId);
    case "practiceAttendance":
      return applyPracticeAttendance(mutation, fields, teamId);
    default:
      throw new Error("Unknown entity");
  }
}

async function applyPlayer(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const existing = await prisma.player.findUnique({ where: { id: m.entityId } });
  if (existing && existing.teamId !== teamId) throw new SyncAuthError("player not in team");

  if (!existing) {
    const created = await prisma.player.create({
      data: {
        id: m.entityId,
        teamId,
        firstName: (fields.firstName as string) ?? "",
        lastNameInitial: (fields.lastNameInitial as string) ?? "",
        jerseyNumber: (fields.jerseyNumber as string) ?? "",
        active: (fields.active as boolean) ?? true,
        order: (fields.order as number) ?? 0,
        fieldTimestamps: Object.fromEntries(Object.keys(fields).map((k) => [k, m.updatedAt])),
      },
    });
    return created;
  }

  const { fields: mergedFields, timestamps } = mergeFieldsLWW(
    existing as unknown as Record<string, unknown>,
    (existing.fieldTimestamps as Record<string, string>) ?? {},
    fields,
    m.updatedAt
  );

  return prisma.player.update({
    where: { id: m.entityId },
    data: {
      firstName: mergedFields.firstName as string,
      lastNameInitial: mergedFields.lastNameInitial as string,
      jerseyNumber: mergedFields.jerseyNumber as string,
      active: mergedFields.active as boolean,
      order: mergedFields.order as number,
      fieldTimestamps: timestamps,
    },
  });
}

async function applyGame(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const existing = await prisma.game.findUnique({ where: { id: m.entityId } });
  if (existing && existing.teamId !== teamId) throw new SyncAuthError("game not in team");

  if (!existing) {
    const created = await prisma.game.create({
      data: {
        id: m.entityId,
        teamId,
        date: new Date((fields.date as string) ?? Date.now()),
        opponent: (fields.opponent as string) ?? "",
        location: (fields.location as string) ?? "",
        periodCount: (fields.periodCount as number) ?? 4,
        status: (fields.status as string) ?? "planned",
        notes: (fields.notes as string) ?? "",
        fieldTimestamps: Object.fromEntries(Object.keys(fields).map((k) => [k, m.updatedAt])),
      },
    });
    return created;
  }

  const existingPlain = { ...existing, date: existing.date.toISOString() } as Record<string, unknown>;
  const { fields: mergedFields, timestamps } = mergeFieldsLWW(
    existingPlain,
    (existing.fieldTimestamps as Record<string, string>) ?? {},
    fields,
    m.updatedAt
  );

  return prisma.game.update({
    where: { id: m.entityId },
    data: {
      date: new Date(mergedFields.date as string),
      opponent: mergedFields.opponent as string,
      location: mergedFields.location as string,
      periodCount: mergedFields.periodCount as number,
      status: mergedFields.status as string,
      notes: mergedFields.notes as string,
      fieldTimestamps: timestamps,
    },
  });
}

async function applyAvailability(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const gameId = fields.gameId as string;
  const playerId = fields.playerId as string;
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.teamId !== teamId) throw new SyncAuthError("game not in team");

  const existing = await prisma.availability.findUnique({ where: { id: m.entityId } });
  if (existing && new Date(m.updatedAt) <= existing.updatedAt) return existing;

  return prisma.availability.upsert({
    where: { id: m.entityId },
    create: {
      id: m.entityId,
      gameId,
      playerId,
      status: (fields.status as string) ?? "available",
      updatedAt: new Date(m.updatedAt),
    },
    update: {
      status: (fields.status as string) ?? "available",
      updatedAt: new Date(m.updatedAt),
    },
  });
}

async function applyAssignment(m: Mutation, fields: Record<string, unknown>, teamId: string, coachId: string) {
  const gameId = fields.gameId as string;
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.teamId !== teamId) throw new SyncAuthError("game not in team");

  const existing = await prisma.assignment.findUnique({ where: { id: m.entityId } });
  if (existing && new Date(m.updatedAt) <= existing.updatedAt) return existing;

  return prisma.assignment.upsert({
    where: { id: m.entityId },
    create: {
      id: m.entityId,
      gameId,
      periodNumber: fields.periodNumber as number,
      slotIndex: fields.slotIndex as number,
      isActual: (fields.isActual as boolean) ?? false,
      playerId: (fields.playerId as string | null) ?? null,
      updatedAt: new Date(m.updatedAt),
      updatedByCoachId: coachId,
    },
    update: {
      playerId: (fields.playerId as string | null) ?? null,
      updatedAt: new Date(m.updatedAt),
      updatedByCoachId: coachId,
    },
  });
}

async function applyGamePeriod(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const gameId = fields.gameId as string;
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.teamId !== teamId) throw new SyncAuthError("game not in team");

  const existing = await prisma.gamePeriod.findUnique({ where: { id: m.entityId } });
  if (existing && new Date(m.updatedAt) <= existing.updatedAt) return existing;

  return prisma.gamePeriod.upsert({
    where: { id: m.entityId },
    create: {
      id: m.entityId,
      gameId,
      periodNumber: fields.periodNumber as number,
      status: (fields.status as string) ?? "planned",
      startedAt: fields.startedAt ? new Date(fields.startedAt as string) : null,
      completedAt: fields.completedAt ? new Date(fields.completedAt as string) : null,
      updatedAt: new Date(m.updatedAt),
    },
    update: {
      status: (fields.status as string) ?? "planned",
      startedAt: fields.startedAt ? new Date(fields.startedAt as string) : null,
      completedAt: fields.completedAt ? new Date(fields.completedAt as string) : null,
      updatedAt: new Date(m.updatedAt),
    },
  });
}

async function applyTeam(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  if (m.entityId !== teamId) throw new SyncAuthError("cannot edit another team");
  const existing = await prisma.team.findUnique({ where: { id: teamId } });
  if (!existing) throw new Error("team not found");

  // Team has no fieldTimestamps column; use plain updatedAt LWW (settings edits are rare/owner-only).
  return prisma.team.update({
    where: { id: teamId },
    data: {
      name: (fields.name as string) ?? existing.name,
      seasonLabel: (fields.seasonLabel as string) ?? existing.seasonLabel,
      playersOnField: (fields.playersOnField as number) ?? existing.playersOnField,
      defaultPeriodCount: (fields.defaultPeriodCount as number) ?? existing.defaultPeriodCount,
      targetMinutes: (fields.targetMinutes as number) ?? existing.targetMinutes,
    },
  });
}

async function applyDrill(m: Mutation, fields: Record<string, unknown>, teamId: string, coachId: string) {
  const existing = await prisma.drill.findUnique({ where: { id: m.entityId } });
  // A drill can only be created or edited in team scope here - forking a library
  // drill means the client creates a brand-new team-scoped row client-side first.
  if (existing && existing.teamId !== teamId) throw new SyncAuthError("drill not in team");

  if (!existing) {
    const created = await prisma.drill.create({
      data: {
        id: m.entityId,
        teamId,
        scope: "team",
        name: (fields.name as string) ?? "",
        slug: (fields.slug as string) ?? "",
        category: (fields.category as string) ?? "warmup",
        focusAreas: (fields.focusAreas as string[]) ?? [],
        defaultMinutes: (fields.defaultMinutes as number) ?? 5,
        minMinutes: (fields.minMinutes as number | null) ?? null,
        maxMinutes: (fields.maxMinutes as number | null) ?? null,
        minPlayers: (fields.minPlayers as number | null) ?? null,
        maxPlayers: (fields.maxPlayers as number | null) ?? null,
        equipment: (fields.equipment as string[]) ?? [],
        setup: (fields.setup as string) ?? "",
        instructions: (fields.instructions as string) ?? "",
        coachingPoints: (fields.coachingPoints as string[]) ?? [],
        progressions: (fields.progressions as string[]) ?? [],
        ageNotes: (fields.ageNotes as string) ?? "",
        sourceDrillId: (fields.sourceDrillId as string | null) ?? null,
        archived: (fields.archived as boolean) ?? false,
        createdBy: coachId,
        updatedBy: coachId,
        fieldTimestamps: Object.fromEntries(Object.keys(fields).map((k) => [k, m.updatedAt])),
      },
    });
    return created;
  }

  const { fields: mergedFields, timestamps } = mergeFieldsLWW(
    existing as unknown as Record<string, unknown>,
    (existing.fieldTimestamps as Record<string, string>) ?? {},
    fields,
    m.updatedAt
  );

  return prisma.drill.update({
    where: { id: m.entityId },
    data: {
      name: mergedFields.name as string,
      slug: mergedFields.slug as string,
      category: mergedFields.category as string,
      focusAreas: (mergedFields.focusAreas as string[]) ?? [],
      defaultMinutes: mergedFields.defaultMinutes as number,
      minMinutes: mergedFields.minMinutes as number | null,
      maxMinutes: mergedFields.maxMinutes as number | null,
      minPlayers: mergedFields.minPlayers as number | null,
      maxPlayers: mergedFields.maxPlayers as number | null,
      equipment: (mergedFields.equipment as string[]) ?? [],
      setup: mergedFields.setup as string,
      instructions: mergedFields.instructions as string,
      coachingPoints: (mergedFields.coachingPoints as string[]) ?? [],
      progressions: (mergedFields.progressions as string[]) ?? [],
      ageNotes: mergedFields.ageNotes as string,
      sourceDrillId: (mergedFields.sourceDrillId as string | null) ?? null,
      archived: (mergedFields.archived as boolean) ?? false,
      updatedBy: coachId,
      fieldTimestamps: timestamps,
    },
  });
}

async function applyDrillArchive(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const drillId = fields.drillId as string;
  const drill = await prisma.drill.findUnique({ where: { id: drillId } });
  if (!drill) throw new SyncAuthError("drill not found");
  // Only library drills (or this team's own drills) can be archived this way; a
  // team's own drills use the plain `archived` field on Drill instead.
  if (drill.scope !== "library" && drill.teamId !== teamId) throw new SyncAuthError("drill not in team");

  return prisma.drillArchive.upsert({
    where: { id: m.entityId },
    create: { id: m.entityId, teamId, drillId, updatedAt: new Date(m.updatedAt) },
    update: { updatedAt: new Date(m.updatedAt) },
  });
}

async function applyPracticePlan(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const existing = await prisma.practicePlan.findUnique({ where: { id: m.entityId } });
  if (existing && existing.teamId !== teamId) throw new SyncAuthError("plan not in team");

  if (!existing) {
    const created = await prisma.practicePlan.create({
      data: {
        id: m.entityId,
        teamId,
        date: fields.date ? new Date(fields.date as string) : null,
        location: (fields.location as string) ?? "",
        targetMinutes: (fields.targetMinutes as number) ?? 30,
        status: (fields.status as string) ?? "draft",
        notes: (fields.notes as string) ?? "",
        isTemplate: (fields.isTemplate as boolean) ?? false,
        templateName: (fields.templateName as string) ?? "",
        fieldTimestamps: Object.fromEntries(Object.keys(fields).map((k) => [k, m.updatedAt])),
      },
    });
    return created;
  }

  const existingPlain = {
    ...existing,
    date: existing.date ? existing.date.toISOString() : null,
  } as Record<string, unknown>;
  const { fields: mergedFields, timestamps } = mergeFieldsLWW(
    existingPlain,
    (existing.fieldTimestamps as Record<string, string>) ?? {},
    fields,
    m.updatedAt
  );

  return prisma.practicePlan.update({
    where: { id: m.entityId },
    data: {
      date: mergedFields.date ? new Date(mergedFields.date as string) : null,
      location: mergedFields.location as string,
      targetMinutes: mergedFields.targetMinutes as number,
      status: mergedFields.status as string,
      notes: mergedFields.notes as string,
      isTemplate: (mergedFields.isTemplate as boolean) ?? false,
      templateName: (mergedFields.templateName as string) ?? "",
      fieldTimestamps: timestamps,
    },
  });
}

async function applyPracticeBlock(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const planId = fields.planId as string;
  const plan = await prisma.practicePlan.findUnique({ where: { id: planId } });
  if (!plan || plan.teamId !== teamId) throw new SyncAuthError("plan not in team");

  const existing = await prisma.practiceBlock.findUnique({ where: { id: m.entityId } });
  if (existing && new Date(m.updatedAt) <= existing.updatedAt) return existing;

  return prisma.practiceBlock.upsert({
    where: { id: m.entityId },
    create: {
      id: m.entityId,
      planId,
      order: (fields.order as number) ?? 0,
      type: (fields.type as string) ?? "drill",
      drillId: (fields.drillId as string | null) ?? null,
      plannedMinutes: (fields.plannedMinutes as number) ?? 0,
      blockNotes: (fields.blockNotes as string) ?? "",
      updatedAt: new Date(m.updatedAt),
    },
    update: {
      order: (fields.order as number) ?? existing?.order ?? 0,
      type: (fields.type as string) ?? existing?.type,
      drillId: fields.drillId !== undefined ? (fields.drillId as string | null) : existing?.drillId,
      plannedMinutes: (fields.plannedMinutes as number) ?? existing?.plannedMinutes,
      blockNotes: fields.blockNotes !== undefined ? (fields.blockNotes as string) : existing?.blockNotes,
      updatedAt: new Date(m.updatedAt),
    },
  });
}

async function applyPracticeAttendance(m: Mutation, fields: Record<string, unknown>, teamId: string) {
  const planId = fields.planId as string;
  const plan = await prisma.practicePlan.findUnique({ where: { id: planId } });
  if (!plan || plan.teamId !== teamId) throw new SyncAuthError("plan not in team");

  const existing = await prisma.practiceAttendance.findUnique({ where: { id: m.entityId } });
  if (existing && new Date(m.updatedAt) <= existing.updatedAt) return existing;

  return prisma.practiceAttendance.upsert({
    where: { id: m.entityId },
    create: {
      id: m.entityId,
      planId,
      playerId: fields.playerId as string,
      status: (fields.status as string) ?? "present",
      updatedAt: new Date(m.updatedAt),
    },
    update: {
      status: (fields.status as string) ?? "present",
      updatedAt: new Date(m.updatedAt),
    },
  });
}
