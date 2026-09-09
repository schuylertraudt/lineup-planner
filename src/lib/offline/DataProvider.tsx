"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { deleteMany, getAll, getMeta, getOutbox, putAll, replaceAll, setMeta } from "./db";
import { enqueueMutation, flushOutbox, pullFromServer, SyncStatus } from "./sync-manager";
import { SyncEntity } from "@/lib/sync/types";

export interface TeamRecord {
  id: string;
  name: string;
  joinCode: string;
  seasonLabel: string;
  playersOnField: number;
  defaultPeriodCount: number;
}
export interface SlotRecord {
  id: string;
  teamId: string;
  order: number;
  name: string;
  group: "GK" | "D" | "M" | "F";
}
export interface PlayerRecord {
  id: string;
  teamId: string;
  firstName: string;
  lastNameInitial: string;
  jerseyNumber: string;
  active: boolean;
  order: number;
  updatedAt: string;
}
export interface GameRecord {
  id: string;
  teamId: string;
  date: string;
  opponent: string;
  location: string;
  periodCount: number;
  status: string;
  notes: string;
  updatedAt: string;
}
export interface AvailabilityRecord {
  id: string;
  gameId: string;
  playerId: string;
  status: "available" | "absent" | "late";
  updatedAt: string;
}
export interface AssignmentRecord {
  id: string;
  gameId: string;
  periodNumber: number;
  slotIndex: number;
  playerId: string | null;
  isActual: boolean;
  updatedAt: string;
}
export interface GamePeriodRecord {
  id: string;
  gameId: string;
  periodNumber: number;
  status: "planned" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}
export interface CoachRecord {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DataState {
  team: TeamRecord | null;
  slots: SlotRecord[];
  players: PlayerRecord[];
  games: GameRecord[];
  availabilities: AvailabilityRecord[];
  assignments: AssignmentRecord[];
  gamePeriods: GamePeriodRecord[];
  coaches: CoachRecord[];
}

const EMPTY_STATE: DataState = {
  team: null,
  slots: [],
  players: [],
  games: [],
  availabilities: [],
  assignments: [],
  gamePeriods: [],
  coaches: [],
};

function upsertList<T extends { id: string }>(list: T[], record: T): T[] {
  const idx = list.findIndex((x) => x.id === record.id);
  if (idx === -1) return [...list, record];
  const copy = [...list];
  copy[idx] = record;
  return copy;
}

interface DataContextValue extends DataState {
  ready: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  coachId: string;
  mutate: (entity: SyncEntity, entityId: string, fields: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
  /** Deletes a game (and everything under it) on the server and purges it locally. Requires connectivity. */
  deleteGame: (gameId: string) => Promise<{ ok: boolean; error?: string }>;
}

const DataContext = createContext<DataContextValue | null>(null);

const STORE_BY_ENTITY: Record<SyncEntity, string> = {
  player: "players",
  game: "games",
  availability: "availabilities",
  assignment: "assignments",
  gamePeriod: "gamePeriods",
  team: "team",
};

export function DataProvider({ coachId, children }: { coachId: string; children: React.ReactNode }) {
  const [state, setState] = useState<DataState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  const applyLocal = useCallback(<K extends keyof DataState>(key: K, updater: (prev: DataState[K]) => DataState[K]) => {
    setState((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  }, []);

  const loadFromIndexedDb = useCallback(async () => {
    const [team, slots, players, games, availabilities, assignments, gamePeriods, coaches] = await Promise.all([
      getAll<TeamRecord>("team"),
      getAll<SlotRecord>("slots"),
      getAll<PlayerRecord>("players"),
      getAll<GameRecord>("games"),
      getAll<AvailabilityRecord>("availabilities"),
      getAll<AssignmentRecord>("assignments"),
      getAll<GamePeriodRecord>("gamePeriods"),
      getAll<CoachRecord>("coaches"),
    ]);
    setState({
      team: team[0] ?? null,
      slots: slots.sort((a, b) => a.order - b.order),
      players: players.sort((a, b) => a.order - b.order),
      games,
      availabilities,
      assignments,
      gamePeriods,
      coaches,
    });
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const outbox = await getOutbox();
    setPendingCount(outbox.length);
    return outbox.length;
  }, []);

  const doFlush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSyncStatus("offline");
        return;
      }
      let remaining = await refreshPendingCount();
      if (remaining === 0) {
        setSyncStatus("synced");
        return;
      }
      setSyncStatus("syncing");
      // Keep flushing batches until the queue is empty or a push fails.
      for (let i = 0; i < 20 && remaining > 0; i++) {
        const result = await flushOutbox();
        if (!result) {
          setSyncStatus("offline");
          await refreshPendingCount();
          return;
        }
        for (const item of result.applied) {
          if (item.ok && item.record) {
            const store = STORE_BY_ENTITY[item.entity];
            await putAll(store, [item.record]);
            applyLocal(store as keyof DataState, (prev) => {
              if (store === "team") return item.record as never;
              return upsertList(prev as unknown as { id: string }[], item.record as { id: string }) as never;
            });
          }
        }
        remaining = result.remaining;
      }
      setPendingCount(remaining);
      setSyncStatus(remaining > 0 ? "pending" : "synced");
    } finally {
      flushingRef.current = false;
    }
  }, [applyLocal, refreshPendingCount]);

  const doPull = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const since = await getMeta("lastPullAt");
    const result = await pullFromServer(since);
    if (!result) return;

    const outbox = await getOutbox();
    const pendingIds = new Set(outbox.map((o) => o.entityId));

    const players = (result.players as PlayerRecord[]).filter((p) => !pendingIds.has(p.id));
    const games = (result.games as GameRecord[]).filter((g) => !pendingIds.has(g.id));
    const availabilities = (result.availabilities as AvailabilityRecord[]).filter((a) => !pendingIds.has(a.id));
    const assignments = (result.assignments as AssignmentRecord[]).filter((a) => !pendingIds.has(a.id));
    const gamePeriods = (result.gamePeriods as GamePeriodRecord[]).filter((g) => !pendingIds.has(g.id));

    await Promise.all([
      putAll("players", players),
      putAll("games", games),
      putAll("availabilities", availabilities),
      putAll("assignments", assignments),
      putAll("gamePeriods", gamePeriods),
      // The server always returns its complete, current position-slot and
      // coach lists (never a delta), so a full replace here is what keeps a
      // slot template edit (which deletes and recreates every slot under
      // new ids) from leaving orphaned old rows sitting in IndexedDB forever.
      replaceAll("slots", result.slots as SlotRecord[]),
      replaceAll("coaches", result.coaches as CoachRecord[]),
    ]);
    if (result.team) await putAll("team", [result.team]);

    setState((prev) => {
      let next = { ...prev };
      if (result.team) next.team = result.team as TeamRecord;
      next.slots = (result.slots as SlotRecord[]).sort((a, b) => a.order - b.order);
      for (const p of players) next.players = upsertList(next.players, p);
      for (const g of games) next.games = upsertList(next.games, g);
      for (const a of availabilities) next.availabilities = upsertList(next.availabilities, a);
      for (const a of assignments) next.assignments = upsertList(next.assignments, a);
      for (const g of gamePeriods) next.gamePeriods = upsertList(next.gamePeriods, g);
      next.coaches = result.coaches as CoachRecord[];
      return next;
    });

    await setMeta("lastPullAt", result.serverTime);
  }, []);

  const mutate = useCallback(
    async (entity: SyncEntity, entityId: string, fields: Record<string, unknown>) => {
      const updatedAt = new Date().toISOString();
      const store = STORE_BY_ENTITY[entity];

      setState((prev) => {
        if (store === "team") {
          return { ...prev, team: prev.team ? { ...prev.team, ...fields, id: entityId } as TeamRecord : ({ id: entityId, ...fields } as TeamRecord) };
        }
        const list = prev[store as keyof DataState] as unknown as { id: string; updatedAt?: string }[];
        const idx = list.findIndex((x) => x.id === entityId);
        const merged = idx === -1 ? { id: entityId, ...fields, updatedAt } : { ...list[idx], ...fields, updatedAt };
        return { ...prev, [store]: upsertList(list, merged as { id: string }) };
      });

      const current = await getAll<{ id: string }>(store);
      const existing = current.find((x) => x.id === entityId);
      const merged = existing ? { ...existing, ...fields, updatedAt } : { id: entityId, ...fields, updatedAt };
      await putAll(store, [merged]);

      await enqueueMutation({
        id: uuid(),
        entity,
        entityId,
        op: "upsert",
        fields,
        updatedAt,
        coachId,
      });
      await refreshPendingCount();
      setSyncStatus((s) => (s === "offline" ? "offline" : "pending"));
      doFlush();
    },
    [coachId, doFlush, refreshPendingCount]
  );

  const refresh = useCallback(async () => {
    await doPull();
    await doFlush();
  }, [doPull, doFlush]);

  const deleteGame = useCallback(async (gameId: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/games/${gameId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error ?? "Delete failed." };
      }
    } catch {
      return { ok: false, error: "Deleting a game requires an internet connection. Try again once you're online." };
    }

    const [availabilities, assignments, gamePeriods] = await Promise.all([
      getAll<AvailabilityRecord>("availabilities"),
      getAll<AssignmentRecord>("assignments"),
      getAll<GamePeriodRecord>("gamePeriods"),
    ]);
    await Promise.all([
      deleteMany("games", [gameId]),
      deleteMany("availabilities", availabilities.filter((a) => a.gameId === gameId).map((a) => a.id)),
      deleteMany("assignments", assignments.filter((a) => a.gameId === gameId).map((a) => a.id)),
      deleteMany("gamePeriods", gamePeriods.filter((g) => g.gameId === gameId).map((g) => g.id)),
    ]);

    setState((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g.id !== gameId),
      availabilities: prev.availabilities.filter((a) => a.gameId !== gameId),
      assignments: prev.assignments.filter((a) => a.gameId !== gameId),
      gamePeriods: prev.gamePeriods.filter((g) => g.gameId !== gameId),
    }));

    return { ok: true };
  }, []);

  useEffect(() => {
    (async () => {
      await loadFromIndexedDb();
      await refreshPendingCount();
      setReady(true);
      await doFlush();
      await doPull();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOnline = () => {
      doFlush();
      doPull();
    };
    const onOffline = () => setSyncStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(() => {
      doFlush();
    }, 15000);
    const pullInterval = setInterval(() => {
      doPull();
    }, 60000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
      clearInterval(pullInterval);
    };
  }, [doFlush, doPull]);

  return (
    <DataContext.Provider value={{ ...state, ready, syncStatus, pendingCount, coachId, mutate, refresh, deleteGame }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
