export type PositionGroup = "GK" | "D" | "M" | "F";

export interface SlotTemplate {
  index: number;
  name: string;
  group: PositionGroup;
}

export interface RosterPlayer {
  id: string;
  firstName: string;
  lastNameInitial: string;
  jerseyNumber: string;
  active: boolean;
  order: number;
}

export type AvailabilityStatus = "available" | "absent" | "late";

/**
 * Player name is stored as firstName + optional lastNameInitial + optional
 * jerseyNumber for backwards compatibility, but the roster UI only exposes a
 * single "name" field to coaches (typed into firstName) — this renders
 * whatever combination of those fields a given player actually has.
 */
export function displayName(p: {
  firstName: string;
  lastNameInitial?: string;
  jerseyNumber?: string;
}): string {
  const base = `${p.firstName} ${p.lastNameInitial ?? ""}`.trim();
  return p.jerseyNumber ? `${base} #${p.jerseyNumber}` : base;
}

export interface PlayerSeasonTotals {
  periodsPlayed: number;
  periodsBenched: number;
  groups: Record<PositionGroup, number>;
  gkPeriods: number;
}

export function emptyTotals(): PlayerSeasonTotals {
  return {
    periodsPlayed: 0,
    periodsBenched: 0,
    groups: { GK: 0, D: 0, M: 0, F: 0 },
    gkPeriods: 0,
  };
}

/** periodNumber -> slotIndex -> playerId | null */
export type PeriodPlan = (string | null)[];
export type GamePlan = PeriodPlan[];
