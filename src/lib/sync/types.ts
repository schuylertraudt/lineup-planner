export type SyncEntity =
  | "player"
  | "game"
  | "availability"
  | "assignment"
  | "gamePeriod"
  | "team"
  | "drill"
  | "drillArchive"
  | "practicePlan"
  | "practiceBlock"
  | "practiceAttendance";

export interface Mutation {
  id: string;
  entity: SyncEntity;
  entityId: string;
  op: "upsert" | "delete";
  fields: Record<string, unknown>;
  updatedAt: string; // ISO timestamp, client clock
  coachId: string;
}

export function deterministicAvailabilityId(gameId: string, playerId: string): string {
  return `${gameId}:${playerId}`;
}

export function deterministicAssignmentId(
  gameId: string,
  periodNumber: number,
  slotIndex: number,
  isActual: boolean
): string {
  return `${gameId}:${periodNumber}:${slotIndex}:${isActual ? "actual" : "plan"}`;
}

export function deterministicGamePeriodId(gameId: string, periodNumber: number): string {
  return `${gameId}:${periodNumber}`;
}

export function deterministicDrillArchiveId(teamId: string, drillId: string): string {
  return `${teamId}:${drillId}`;
}

export function deterministicPracticeAttendanceId(planId: string, playerId: string): string {
  return `${planId}:${playerId}`;
}
