import { v4 as uuid } from "uuid";
import { deterministicAssignmentId, deterministicAvailabilityId, deterministicGamePeriodId } from "@/lib/sync/types";

type Mutate = (entity: "player" | "game" | "availability" | "assignment" | "gamePeriod" | "team", entityId: string, fields: Record<string, unknown>) => Promise<void>;

export function newId(): string {
  return uuid();
}

export async function createPlayer(
  mutate: Mutate,
  data: { firstName: string; lastNameInitial?: string; jerseyNumber?: string; order: number }
): Promise<string> {
  const id = newId();
  await mutate("player", id, {
    firstName: data.firstName,
    lastNameInitial: data.lastNameInitial ?? "",
    jerseyNumber: data.jerseyNumber ?? "",
    active: true,
    order: data.order,
  });
  return id;
}

export async function updatePlayer(mutate: Mutate, id: string, fields: Record<string, unknown>) {
  await mutate("player", id, fields);
}

export async function setPlayerActive(mutate: Mutate, id: string, active: boolean) {
  await mutate("player", id, { active });
}

export async function createGame(
  mutate: Mutate,
  data: { date: string; opponent: string; location?: string; periodCount: number }
): Promise<string> {
  const id = newId();
  await mutate("game", id, {
    date: data.date,
    opponent: data.opponent,
    location: data.location ?? "",
    periodCount: data.periodCount,
    status: "planned",
    notes: "",
  });
  return id;
}

export async function updateGame(mutate: Mutate, id: string, fields: Record<string, unknown>) {
  await mutate("game", id, fields);
}

export async function setAvailability(
  mutate: Mutate,
  gameId: string,
  playerId: string,
  status: "available" | "absent" | "late"
) {
  const id = deterministicAvailabilityId(gameId, playerId);
  await mutate("availability", id, { gameId, playerId, status });
}

export async function setAssignment(
  mutate: Mutate,
  gameId: string,
  periodNumber: number,
  slotIndex: number,
  playerId: string | null,
  isActual: boolean
) {
  const id = deterministicAssignmentId(gameId, periodNumber, slotIndex, isActual);
  await mutate("assignment", id, { gameId, periodNumber, slotIndex, playerId, isActual });
}

export async function setGamePeriodStatus(
  mutate: Mutate,
  gameId: string,
  periodNumber: number,
  status: "planned" | "in_progress" | "completed",
  extra: { startedAt?: string; completedAt?: string } = {}
) {
  const id = deterministicGamePeriodId(gameId, periodNumber);
  await mutate("gamePeriod", id, { gameId, periodNumber, status, ...extra });
}

export async function updateTeamSettings(mutate: Mutate, teamId: string, fields: Record<string, unknown>) {
  await mutate("team", teamId, fields);
}
