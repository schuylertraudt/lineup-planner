"use client";

import Link from "next/link";
import { useData } from "@/lib/offline/DataProvider";

export default function PracticeHubPage() {
  const { drills, practicePlans, ready } = useData();
  const upcoming = practicePlans.filter((p) => !p.isTemplate && (!p.date || new Date(p.date) >= new Date(new Date().toDateString())));

  if (!ready) return <p className="p-6 text-slate-500">Loading...</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold">Practice</h1>

      <Link href="/practice/plans" className="card p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">Practice Plans</p>
          <p className="text-sm text-slate-500">{upcoming.length} upcoming</p>
        </div>
        <span className="text-slate-400">&rarr;</span>
      </Link>

      <Link href="/practice/drills" className="card p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">Drill Library</p>
          <p className="text-sm text-slate-500">{drills.length} drills</p>
        </div>
        <span className="text-slate-400">&rarr;</span>
      </Link>

      <Link href="/practice/log" className="card p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">Practice Log</p>
          <p className="text-sm text-slate-500">Season history &amp; focus-area coverage</p>
        </div>
        <span className="text-slate-400">&rarr;</span>
      </Link>
    </div>
  );
}
