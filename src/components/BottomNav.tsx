"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/season", label: "Season" },
  { href: "/roster", label: "Roster" },
  { href: "/fairness", label: "Fairness" },
  { href: "/practice", label: "Practice" },
  { href: "/settings", label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-30" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 min-h-touch flex items-center justify-center text-sm font-semibold py-3 ${
              active ? "text-field border-t-2 border-field" : "text-slate-500 border-t-2 border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
