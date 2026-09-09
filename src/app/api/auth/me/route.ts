import { NextResponse } from "next/server";
import { getCurrentCoach } from "@/lib/auth";

export async function GET() {
  const coach = await getCurrentCoach();
  if (!coach) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ coach });
}
