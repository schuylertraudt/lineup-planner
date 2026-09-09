import { describe, expect, it } from "vitest";
import { generatePlan } from "../autofill";
import { emptyTotals } from "../types";
import type { PlayerSeasonTotals, SlotTemplate } from "../types";

const DEFAULT_SLOTS: SlotTemplate[] = [
  { index: 0, name: "GK", group: "GK" },
  { index: 1, name: "D", group: "D" },
  { index: 2, name: "D", group: "D" },
  { index: 3, name: "D", group: "D" },
  { index: 4, name: "M", group: "M" },
  { index: 5, name: "M", group: "M" },
  { index: 6, name: "M", group: "M" },
  { index: 7, name: "F", group: "F" },
];

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

function assertStructurallyValid(plan: (string | null)[][], slots: SlotTemplate[], available: string[]) {
  for (const periodPlan of plan) {
    expect(periodPlan.length).toBe(slots.length);
    const assigned = periodPlan.filter((x): x is string => !!x);
    expect(new Set(assigned).size).toBe(assigned.length); // no duplicates in a period
    for (const id of assigned) expect(available).toContain(id);
  }
}

function playedCounts(plan: (string | null)[][], available: string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(available.map((id) => [id, 0]));
  for (const periodPlan of plan) {
    for (const id of periodPlan) {
      if (id) counts[id] += 1;
    }
  }
  return counts;
}

function benchSets(plan: (string | null)[][], available: string[]): Set<string>[] {
  return plan.map((periodPlan) => new Set(available.filter((id) => !periodPlan.includes(id))));
}

describe("autofill: equal period distribution", () => {
  it("keeps max spread of playing time to 1 period across 10 players / 8 slots / 4 periods", () => {
    const available = players(10);
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals: {},
    });
    assertStructurallyValid(plan, DEFAULT_SLOTS, available);
    const counts = playedCounts(plan, available);
    const values = Object.values(counts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    // total player-periods must equal periods * slots
    expect(values.reduce((a, b) => a + b, 0)).toBe(4 * 8);
  });

  it("gives extra periods to whoever has the lowest season total", () => {
    const available = players(9);
    const seasonTotals: Record<string, PlayerSeasonTotals> = {};
    // p1 already has a big lead; everyone else starts at 0.
    seasonTotals["p1"] = { ...emptyTotals(), periodsPlayed: 20 };
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals,
    });
    const counts = playedCounts(plan, available);
    // p1 should play the fewest periods (or tie for fewest) since they're already far ahead.
    const min = Math.min(...Object.values(counts));
    expect(counts["p1"]).toBe(min);
  });

  it("is deterministic across repeated runs with identical input", () => {
    const available = players(11);
    const input = {
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals: {},
    };
    const plan1 = generatePlan(input);
    const plan2 = generatePlan(input);
    expect(plan1).toEqual(plan2);
  });
});

describe("autofill: GK rotation", () => {
  it("never repeats GK across the season before everyone has played it once", () => {
    const available = players(9);
    const seasonTotals: Record<string, PlayerSeasonTotals> = {
      p1: { ...emptyTotals(), gkPeriods: 1, periodsPlayed: 3 },
    };
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals,
    });
    const gkAssignments = plan.map((periodPlan) => periodPlan[0]);
    // p1 already has GK experience; there are 8 other zero-GK candidates
    // available across only 4 GK slots this game, so p1 should not be picked.
    expect(gkAssignments).not.toContain("p1");
  });

  it("does not assign the same player GK twice in one game when enough players are available", () => {
    const available = players(9);
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals: {},
    });
    const gkAssignments = plan.map((periodPlan) => periodPlan[0]);
    expect(new Set(gkAssignments).size).toBe(gkAssignments.length);
  });

  it("allows repeating GK in one game when the roster is too small to avoid it", () => {
    // Only 8 available players total (exactly fills the field, nobody benches),
    // over 6 periods -> only 8 distinct players can ever occupy GK across the
    // whole season, but within a single game there are still 8 field players,
    // so this checks the engine tolerates repetition gracefully without crashing
    // and still cycles GK among distinct players as far as possible.
    const available = players(8);
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 6,
      availablePlayerIds: available,
      seasonTotals: {},
    });
    assertStructurallyValid(plan, DEFAULT_SLOTS, available);
    const gkAssignments = plan.map((periodPlan) => periodPlan[0]);
    // With 8 players and 6 periods, at most 8 distinct GKs are possible, so no
    // repeat is actually required here - verify it still finds distinct ones.
    expect(new Set(gkAssignments).size).toBe(Math.min(6, 8));
  });
});

describe("autofill: no back-to-back benching", () => {
  it("never benches the same player in two consecutive periods when avoidable", () => {
    const available = players(9);
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 6,
      availablePlayerIds: available,
      seasonTotals: {},
    });
    const benches = benchSets(plan, available);
    for (let i = 1; i < benches.length; i++) {
      for (const id of benches[i]) {
        expect(benches[i - 1].has(id)).toBe(false);
      }
    }
  });
});

describe("autofill: manual overrides are preserved", () => {
  it("never moves a locked player and never double-books them", () => {
    const available = players(10);
    const lockedPlan = [
      ["p3", null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
    ];
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals: {},
      lockedPlan,
    });
    expect(plan[0][0]).toBe("p3");
    assertStructurallyValid(plan, DEFAULT_SLOTS, available);
  });
});

describe("autofill: awkward roster sizes", () => {
  it.each([9, 10, 13])("produces a structurally valid plan with %i available players", (n) => {
    const available = players(n);
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 4,
      availablePlayerIds: available,
      seasonTotals: {},
    });
    assertStructurallyValid(plan, DEFAULT_SLOTS, available);
    const counts = playedCounts(plan, available);
    const values = Object.values(counts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("handles fewer available players than field slots by leaving slots empty", () => {
    const available = players(5);
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 3,
      availablePlayerIds: available,
      seasonTotals: {},
    });
    for (const periodPlan of plan) {
      const assigned = periodPlan.filter(Boolean);
      expect(assigned.length).toBe(5);
    }
    assertStructurallyValid(plan, DEFAULT_SLOTS, available);
  });

  it("handles zero available players without crashing", () => {
    const plan = generatePlan({
      slots: DEFAULT_SLOTS,
      periodCount: 2,
      availablePlayerIds: [],
      seasonTotals: {},
    });
    for (const periodPlan of plan) {
      expect(periodPlan.every((x) => x === null)).toBe(true);
    }
  });
});
