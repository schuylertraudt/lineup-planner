import { DrillRecord, PracticeBlockRecord } from "@/lib/offline/DataProvider";
import { blockDrills } from "@/lib/practice/drills";

export interface AutoBalanceChange {
  blockId: string;
  plannedMinutes: number;
}

/**
 * Redistributes the gap between planned and target minutes across drill and
 * split blocks only (break/talk/free_play are left alone - a coach picked
 * those durations deliberately), one minute at a time in round-robin order,
 * never pushing a block below the tightest minMinutes or above the
 * loosest maxMinutes of the drill(s) it holds. Stops early if every
 * eligible block hits its floor/ceiling before the gap closes.
 */
export function computeAutoBalance(blocks: PracticeBlockRecord[], drills: DrillRecord[], targetMinutes: number): AutoBalanceChange[] {
  const working = blocks.map((b) => {
    const blockDrillList = blockDrills(b, drills);
    return {
      id: b.id,
      type: b.type,
      minutes: b.plannedMinutes,
      min: blockDrillList.length > 0 ? Math.max(...blockDrillList.map((d) => d.minMinutes ?? 1)) : undefined,
      max: blockDrillList.length > 0 ? Math.min(...blockDrillList.map((d) => d.maxMinutes ?? Infinity)) : undefined,
    };
  });

  const total = working.reduce((sum, b) => sum + b.minutes, 0);
  const delta = targetMinutes - total;
  if (delta === 0) return [];

  const eligible = working.filter((b) => (b.type === "drill" || b.type === "split") && b.min !== undefined);
  if (eligible.length === 0) return [];

  const direction = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);

  while (remaining > 0) {
    let madeProgress = false;
    for (const b of eligible) {
      if (remaining <= 0) break;
      const next = b.minutes + direction;
      if (next < b.min! || next > b.max!) continue;
      b.minutes = next;
      remaining -= 1;
      madeProgress = true;
    }
    if (!madeProgress) break;
  }

  const original = new Map(blocks.map((b) => [b.id, b.plannedMinutes]));
  return eligible.filter((b) => b.minutes !== original.get(b.id)).map((b) => ({ blockId: b.id, plannedMinutes: b.minutes }));
}
