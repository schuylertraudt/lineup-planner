import { addToOutbox, getOutbox, OutboxItem, removeFromOutbox, setMeta } from "./db";
import { Mutation, SyncEntity } from "@/lib/sync/types";

export type SyncStatus = "synced" | "pending" | "offline" | "syncing";

export interface PullResult {
  serverTime: string;
  team: unknown;
  slots: unknown[];
  players: unknown[];
  games: unknown[];
  availabilities: unknown[];
  assignments: unknown[];
  gamePeriods: unknown[];
  coaches: unknown[];
  drills: unknown[];
  drillArchives: unknown[];
  practicePlans: unknown[];
  practiceBlocks: unknown[];
  practiceAttendances: unknown[];
}

export async function pullFromServer(since: string | undefined): Promise<PullResult | null> {
  try {
    const url = since ? `/api/sync/pull?since=${encodeURIComponent(since)}` : "/api/sync/pull";
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface PushResultItem {
  mutationId: string;
  entity: SyncEntity;
  entityId: string;
  op: "upsert" | "delete";
  ok: boolean;
  record?: Record<string, unknown> | null;
  error?: string;
}

export async function enqueueMutation(m: Omit<OutboxItem, "createdAt">): Promise<void> {
  await addToOutbox({ ...m, createdAt: new Date().toISOString() });
}

const BATCH_SIZE = 25;

/** Push whatever is in the outbox. Returns applied records for state reconciliation, or null on network failure. */
export async function flushOutbox(): Promise<{ applied: PushResultItem[]; remaining: number } | null> {
  const items = await getOutbox();
  if (items.length === 0) return { applied: [], remaining: 0 };

  const batch = items.slice(0, BATCH_SIZE);
  const mutations: Mutation[] = batch.map((i) => ({
    id: i.id,
    entity: i.entity as SyncEntity,
    entityId: i.entityId,
    op: i.op,
    fields: i.fields,
    updatedAt: i.updatedAt,
    coachId: i.coachId,
  }));

  try {
    const res = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mutations }),
    });
    if (!res.ok) return null;
    const data: { results: PushResultItem[]; serverTime: string } = await res.json();
    for (const result of data.results) {
      if (result.ok) {
        await removeFromOutbox(result.mutationId);
      } else {
        // Drop mutations the server rejects outright (bad auth/entity) so the
        // queue doesn't jam forever on one bad item; keep it otherwise.
        if (result.error && result.error.includes("not in team")) {
          await removeFromOutbox(result.mutationId);
        }
      }
    }
    await setMeta("lastServerTime", data.serverTime);
    const remainingItems = await getOutbox();
    return { applied: data.results, remaining: remainingItems.length };
  } catch {
    return null;
  }
}
