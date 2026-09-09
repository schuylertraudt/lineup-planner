import { prisma } from "../db";
import { Mutation } from "./types";
import { mergeFieldsLWW } from "./merge";

const ALLOWED_FIELDS: Record<Mutation["entity"], string[]> = {
  player: ["firstName", "lastNameInitial", "jerseyNumber", "active", "order"],
  game: ["date", "opponent", "location", "periodCount", "status", "notes"],
  availability: ["status", "gameId", "playerId"],
  assignment: ["playerId", "gameId", "periodNumber", "slotIndex", "isActual", "updatedByCoachId"],
  gamePeriod: ["status", "startedAt", "completedAt", "gameId", "periodNumber"],
  team: ["name", "seasonLabel", "playersOnField", "defaultPeriodCount"],
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
    },
  });
}
