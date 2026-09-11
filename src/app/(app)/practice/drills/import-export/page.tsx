"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";
import { createDrill } from "@/lib/offline/actions";
import { DrillImportError, exportTeamDrillsToJson, parseDrillImport } from "@/lib/practice/drillImportExport";

export default function DrillImportExportPage() {
  const { team, drills, mutate } = useData();
  const [importText, setImportText] = useState("");
  const [errors, setErrors] = useState<DrillImportError[]>([]);
  const [validCount, setValidCount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedMessage, setImportedMessage] = useState("");

  const teamDrillCount = drills.filter((d) => d.scope === "team").length;

  function downloadExport() {
    const json = exportTeamDrillsToJson(drills);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(team?.name ?? "team").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-drills.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function validate() {
    const result = parseDrillImport(importText);
    setErrors(result.errors);
    setValidCount(result.errors.length === 0 ? result.valid.length : null);
    setImportedMessage("");
  }

  async function doImport() {
    const result = parseDrillImport(importText);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      setValidCount(null);
      return;
    }
    setImporting(true);
    for (const input of result.valid) {
      await createDrill(mutate, input);
    }
    setImporting(false);
    setImportedMessage(`Imported ${result.valid.length} drill${result.valid.length === 1 ? "" : "s"}.`);
    setImportText("");
    setErrors([]);
    setValidCount(null);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Import / Export</h1>
        <Link href="/practice/drills" className="text-sm font-semibold text-field underline">Back to library</Link>
      </div>

      <div className="card p-4 space-y-3">
        <p className="font-semibold">Export</p>
        <p className="text-sm text-slate-500">
          Downloads your team&apos;s {teamDrillCount} custom drill{teamDrillCount === 1 ? "" : "s"} as a JSON file. Library
          drills aren&apos;t included - they&apos;re shared and already available to every team.
        </p>
        <button className="btn-secondary w-full" onClick={downloadExport} disabled={teamDrillCount === 0}>
          Download JSON
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <p className="font-semibold">Import</p>
        <p className="text-sm text-slate-500">
          Paste a JSON array of drills (the same shape Export produces - see the README for the full schema). Each entry
          becomes a new drill owned by your team; nothing is imported if any entry has an error.
        </p>
        <textarea
          className="input min-h-[160px] font-mono text-xs"
          placeholder='[{"name": "...", "category": "warmup", "defaultMinutes": 5}]'
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setErrors([]);
            setValidCount(null);
            setImportedMessage("");
          }}
        />
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={validate} disabled={!importText.trim()}>Validate</button>
          <button className="btn-primary flex-1" onClick={doImport} disabled={!importText.trim() || importing}>
            {importing ? "Importing..." : "Import"}
          </button>
        </div>

        {importedMessage && <p className="text-sm font-semibold text-emerald-700">{importedMessage}</p>}

        {validCount !== null && (
          <p className="text-sm font-semibold text-emerald-700">{validCount} drill{validCount === 1 ? "" : "s"} valid and ready to import.</p>
        )}

        {errors.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-700">Fix these before importing:</p>
            <ul className="text-sm text-red-700 list-disc list-inside">
              {errors.map((e, i) => (
                <li key={i}>{e.index === -1 ? e.message : `Entry ${e.index + 1}: ${e.message}`}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
