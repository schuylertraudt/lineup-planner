import { v4 as uuid } from "uuid";
import {
  deterministicAssignmentId,
  deterministicAvailabilityId,
  deterministicGamePeriodId,
  deterministicPracticeAttendanceId,
  SyncEntity,
} from "@/lib/sync/types";
type Mutate = (entity: SyncEntity, entityId: string, fields: Record<string, unknown>, op?: "upsert" | "delete") => Promise<void>;

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

export interface DrillInput {
  name: string;
  slug?: string;
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
  sourceDrillId?: string | null;
}

export async function createDrill(mutate: Mutate, data: DrillInput): Promise<string> {
  const id = newId();
  await mutate("drill", id, {
    name: data.name,
    slug: data.slug ?? "",
    category: data.category,
    focusAreas: data.focusAreas ?? [],
    defaultMinutes: data.defaultMinutes,
    minMinutes: data.minMinutes ?? null,
    maxMinutes: data.maxMinutes ?? null,
    minPlayers: data.minPlayers ?? null,
    maxPlayers: data.maxPlayers ?? null,
    equipment: data.equipment ?? [],
    setup: data.setup ?? "",
    instructions: data.instructions ?? "",
    coachingPoints: data.coachingPoints ?? [],
    progressions: data.progressions ?? [],
    ageNotes: data.ageNotes ?? "",
    sourceDrillId: data.sourceDrillId ?? null,
    archived: false,
  });
  return id;
}

export async function updateDrill(mutate: Mutate, id: string, fields: Record<string, unknown>) {
  await mutate("drill", id, fields);
}

export async function setTeamDrillArchived(mutate: Mutate, id: string, archived: boolean) {
  await mutate("drill", id, { archived });
}

export async function setPracticeAttendance(
  mutate: Mutate,
  planId: string,
  playerId: string,
  status: "present" | "absent" | "late"
) {
  const id = deterministicPracticeAttendanceId(planId, playerId);
  await mutate("practiceAttendance", id, { planId, playerId, status });
}

export async function createPracticePlan(
  mutate: Mutate,
  data: { teamId: string; date?: string | null; location?: string; targetMinutes: number }
): Promise<string> {
  const id = newId();
  await mutate("practicePlan", id, {
    date: data.date ?? null,
    location: data.location ?? "",
    targetMinutes: data.targetMinutes,
    status: "draft",
    notes: "",
    isTemplate: false,
    templateName: "",
  });
  return id;
}

export async function updatePracticePlan(mutate: Mutate, id: string, fields: Record<string, unknown>) {
  await mutate("practicePlan", id, fields);
}

export async function createPracticeBlock(
  mutate: Mutate,
  data: { planId: string; order: number; type: "drill" | "break" | "talk" | "free_play"; drillId?: string | null; plannedMinutes: number }
): Promise<string> {
  const id = newId();
  await mutate("practiceBlock", id, {
    planId: data.planId,
    order: data.order,
    type: data.type,
    drillId: data.drillId ?? null,
    plannedMinutes: data.plannedMinutes,
    blockNotes: "",
  });
  return id;
}

export async function updatePracticeBlock(mutate: Mutate, id: string, fields: Record<string, unknown>) {
  await mutate("practiceBlock", id, fields);
}

export async function deletePracticeBlock(mutate: Mutate, id: string, planId: string) {
  await mutate("practiceBlock", id, { planId }, "delete");
}

interface DuplicatablePlan {
  location: string;
  targetMinutes: number;
}
interface DuplicatableBlock {
  order: number;
  type: string;
  drillId: string | null;
  plannedMinutes: number;
  blockNotes: string;
}

/** Copies a plan's (or template's) blocks into a brand-new plan. Used by "duplicate", "save as template", and "new from template". */
export async function duplicatePracticePlan(
  mutate: Mutate,
  source: DuplicatablePlan,
  sourceBlocks: DuplicatableBlock[],
  overrides: { date?: string | null; isTemplate?: boolean; templateName?: string; status?: string } = {}
): Promise<string> {
  const id = newId();
  await mutate("practicePlan", id, {
    date: overrides.date ?? null,
    location: source.location,
    targetMinutes: source.targetMinutes,
    status: overrides.status ?? "draft",
    notes: "",
    isTemplate: overrides.isTemplate ?? false,
    templateName: overrides.templateName ?? "",
  });
  for (const block of [...sourceBlocks].sort((a, b) => a.order - b.order)) {
    await createPracticeBlock(mutate, {
      planId: id,
      order: block.order,
      type: block.type as "drill" | "break" | "talk" | "free_play",
      drillId: block.drillId,
      plannedMinutes: block.plannedMinutes,
    });
  }
  return id;
}
