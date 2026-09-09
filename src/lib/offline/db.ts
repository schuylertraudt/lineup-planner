import { openDB, IDBPDatabase } from "idb";

export const DB_NAME = "lineup-planner";
export const DB_VERSION = 1;

export interface OutboxItem {
  id: string;
  entity: string;
  entityId: string;
  op: "upsert" | "delete";
  fields: Record<string, unknown>;
  updatedAt: string;
  coachId: string;
  createdAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("team")) db.createObjectStore("team", { keyPath: "id" });
        if (!db.objectStoreNames.contains("slots")) db.createObjectStore("slots", { keyPath: "id" });
        if (!db.objectStoreNames.contains("players")) db.createObjectStore("players", { keyPath: "id" });
        if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "id" });
        if (!db.objectStoreNames.contains("availabilities")) db.createObjectStore("availabilities", { keyPath: "id" });
        if (!db.objectStoreNames.contains("assignments")) db.createObjectStore("assignments", { keyPath: "id" });
        if (!db.objectStoreNames.contains("gamePeriods")) db.createObjectStore("gamePeriods", { keyPath: "id" });
        if (!db.objectStoreNames.contains("coaches")) db.createObjectStore("coaches", { keyPath: "id" });
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await getDb();
  return db.getAll(store);
}

export async function putAll(store: string, items: unknown[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(store, "readwrite");
  await Promise.all(items.map((item) => tx.store.put(item)));
  await tx.done;
}

/**
 * Replaces the entire contents of a store with exactly these items. Use
 * this for collections the server always returns as a complete, current
 * snapshot (position slots, coaches) rather than a delta — a plain putAll
 * would only ever add/update rows and never remove ones the server deleted
 * (e.g. a position template edit deletes-and-recreates every slot with new
 * ids), leaving stale rows to accumulate locally forever.
 */
export async function replaceAll(store: string, items: unknown[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(store, "readwrite");
  await tx.store.clear();
  await Promise.all(items.map((item) => tx.store.put(item)));
  await tx.done;
}

export async function deleteMany(store: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(store, "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function put(store: string, item: unknown): Promise<void> {
  const db = await getDb();
  await db.put(store, item);
}

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.get("meta", key);
  return row?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value });
}

export async function addToOutbox(item: OutboxItem): Promise<void> {
  const db = await getDb();
  await db.put("outbox", item);
}

export async function getOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  const all: OutboxItem[] = await db.getAll("outbox");
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromOutbox(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", id);
}
