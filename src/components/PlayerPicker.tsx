"use client";

import { PlayerRecord } from "@/lib/offline/DataProvider";
import { displayName, PlayerSeasonTotals, PositionGroup, emptyTotals } from "@/lib/types";
import { PositionGroupTally } from "./PositionGroupTally";

export interface PickerCandidate {
  player: PlayerRecord;
  seasonTotals: PlayerSeasonTotals;
  gameTotals: PlayerSeasonTotals;
  assignedElsewhereThisPeriod: boolean;
}

export function PlayerPicker({
  open,
  slotName,
  slotGroup,
  candidates,
  onSelect,
  onClear,
  onClose,
}: {
  open: boolean;
  slotName: string;
  slotGroup: PositionGroup;
  candidates: PickerCandidate[];
  onSelect: (playerId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const sorted = [...candidates].sort((a, b) => {
    const groupDiff = a.seasonTotals.groups[slotGroup] - b.seasonTotals.groups[slotGroup];
    if (groupDiff !== 0) return groupDiff;
    const playedDiff = a.gameTotals.periodsPlayed - b.gameTotals.periodsPlayed;
    if (playedDiff !== 0) return playedDiff;
    return a.player.order - b.player.order;
  });

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-lg">Assign {slotName}</h2>
          <button className="btn-secondary !min-h-0 px-3 py-1" onClick={onClose}>Close</button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          <button
            className="w-full text-left px-4 py-3 min-h-touch text-slate-500 font-medium hover:bg-slate-50"
            onClick={onClear}
          >
            Leave empty (bench)
          </button>
          {sorted.map(({ player, seasonTotals, gameTotals, assignedElsewhereThisPeriod }) => (
            <button
              key={player.id}
              className="w-full text-left px-4 py-3 min-h-touch hover:bg-slate-50 flex flex-col gap-1"
              onClick={() => onSelect(player.id)}
            >
              <p className="font-semibold">
                {displayName(player)}
                {assignedElsewhereThisPeriod && (
                  <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    already in this period
                  </span>
                )}
              </p>
              <div className="flex items-center justify-between gap-2">
                <PositionGroupTally totals={gameTotals} label="This game" />
                <PositionGroupTally totals={seasonTotals ?? emptyTotals()} label="Season" />
              </div>
            </button>
          ))}
          {sorted.length === 0 && <p className="p-6 text-center text-slate-500">No available players.</p>}
        </div>
      </div>
    </div>
  );
}
