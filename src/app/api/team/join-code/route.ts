import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach, generateJoinCode } from "@/lib/auth";

export async function POST() {
  try {
    const coach = await requireTeamCoach();
    if (coach.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can regenerate the join code" }, { status: 403 });
    }
    let joinCode = generateJoinCode();
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.team.findUnique({ where: { joinCode } });
      if (!clash) break;
      joinCode = generateJoinCode();
    }
    const team = await prisma.team.update({ where: { id: coach.teamId }, data: { joinCode } });
    return NextResponse.json({ joinCode: team.joinCode });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
