import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const coach = await requireTeamCoach();
    const since = req.nextUrl.searchParams.get("since");
    const sinceDate = since ? new Date(since) : new Date(0);

    const [
      team,
      seasons,
      slots,
      players,
      games,
      availabilities,
      assignments,
      gamePeriods,
      coaches,
      drills,
      practicePlans,
      practiceBlocks,
      practiceAttendances,
    ] = await Promise.all([
      prisma.team.findUnique({ where: { id: coach.teamId } }),
      prisma.season.findMany({ where: { teamId: coach.teamId }, orderBy: { createdAt: "asc" } }),
      prisma.positionSlot.findMany({ where: { season: { teamId: coach.teamId } }, orderBy: { order: "asc" } }),
      prisma.player.findMany({ where: { season: { teamId: coach.teamId }, updatedAt: { gt: sinceDate } } }),
      prisma.game.findMany({ where: { season: { teamId: coach.teamId }, updatedAt: { gt: sinceDate } } }),
      prisma.availability.findMany({
        where: { updatedAt: { gt: sinceDate }, game: { season: { teamId: coach.teamId } } },
      }),
      prisma.assignment.findMany({
        where: { updatedAt: { gt: sinceDate }, game: { season: { teamId: coach.teamId } } },
      }),
      prisma.gamePeriod.findMany({
        where: { updatedAt: { gt: sinceDate }, game: { season: { teamId: coach.teamId } } },
      }),
      prisma.coach.findMany({
        where: { teamId: coach.teamId },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.drill.findMany({ where: { teamId: coach.teamId, updatedAt: { gt: sinceDate } } }),
      prisma.practicePlan.findMany({ where: { teamId: coach.teamId, updatedAt: { gt: sinceDate } } }),
      prisma.practiceBlock.findMany({
        where: { updatedAt: { gt: sinceDate }, plan: { teamId: coach.teamId } },
      }),
      prisma.practiceAttendance.findMany({
        where: { updatedAt: { gt: sinceDate }, plan: { teamId: coach.teamId } },
      }),
    ]);

    return NextResponse.json({
      serverTime: new Date().toISOString(),
      team,
      seasons,
      slots,
      players,
      games,
      availabilities,
      assignments,
      gamePeriods,
      coaches,
      drills,
      practicePlans,
      practiceBlocks,
      practiceAttendances,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
