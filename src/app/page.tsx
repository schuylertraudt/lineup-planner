import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/auth";

export default async function RootPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login");
  redirect("/season");
}
