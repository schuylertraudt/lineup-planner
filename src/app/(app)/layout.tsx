import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login");
  if (!coach.teamId) redirect("/join");

  return <AppShell coachId={coach.id} coachName={coach.name}>{children}</AppShell>;
}
