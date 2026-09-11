"use client";

import { DrillRecord } from "@/lib/offline/DataProvider";
import { DrillInfoCard } from "./DrillInfoCard";

/** A quick-look bottom sheet for a drill's full details (equipment, setup, instructions, coaching points) - for spots like the plan builder where tapping through to the drill library page would lose your place. */
export function DrillInfoSheet({ drill, onClose }: { drill: DrillRecord | null; onClose: () => void }) {
  if (!drill) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <h2 className="font-bold text-lg">{drill.name}</h2>
          <button className="btn-secondary !min-h-0 px-3 py-1 shrink-0" onClick={onClose}>Close</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          <DrillInfoCard drill={drill} />
        </div>
      </div>
    </div>
  );
}
