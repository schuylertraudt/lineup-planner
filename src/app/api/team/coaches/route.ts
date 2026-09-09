import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function GET() {
  try {
    const coach = await requireTeamCoach();
    const coaches = await prisma.coach.findMany({
      where: { teamId: coach.teamId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ coaches });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
