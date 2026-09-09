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
