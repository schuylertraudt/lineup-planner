"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/offline/DataProvider";
import { createDrill } from "@/lib/offline/actions";
import { BLANK_DRILL_FORM, DrillForm, drillFormToInput, DrillFormValue } from "@/components/DrillForm";

export default function NewDrillPage() {
  const router = useRouter();
  const { mutate } = useData();
  const [value, setValue] = useState<DrillFormValue>(BLANK_DRILL_FORM);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.name.trim()) return;
    setSaving(true);
    const id = await createDrill(mutate, drillFormToInput(value));
    router.push(`/practice/drills/${id}`);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold">New Drill</h1>
      <div className="card p-4">
        <DrillForm value={value} onChange={setValue} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={saving || !value.name.trim()} onClick={save}>
          Save drill
        </button>
        <button className="btn-secondary" onClick={() => router.back()}>Cancel</button>
      </div>
    </div>
  );
}
