import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function GET() {
  try {
    const coach = await requireTeamCoach();
    const team = await prisma.team.findUnique({
      where: { id: coach.teamId },
      include: { slots: { orderBy: { order: "asc" } } },
    });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    return NextResponse.json({ team });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
