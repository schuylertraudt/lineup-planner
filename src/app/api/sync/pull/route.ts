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
      slots,
      players,
      games,
      availabilities,
      assignments,
      gamePeriods,
      coaches,
      drills,
      drillArchives,
      practicePlans,
      practiceBlocks,
      practiceAttendances,
    ] = await Promise.all([
      prisma.team.findUnique({ where: { id: coach.teamId } }),
      prisma.positionSlot.findMany({ where: { teamId: coach.teamId }, orderBy: { order: "asc" } }),
      prisma.player.findMany({ where: { teamId: coach.teamId, updatedAt: { gt: sinceDate } } }),
      prisma.game.findMany({ where: { teamId: coach.teamId, updatedAt: { gt: sinceDate } } }),
      prisma.availability.findMany({
        where: { updatedAt: { gt: sinceDate }, game: { teamId: coach.teamId } },
      }),
      prisma.assignment.findMany({
        where: { updatedAt: { gt: sinceDate }, game: { teamId: coach.teamId } },
      }),
      prisma.gamePeriod.findMany({
        where: { updatedAt: { gt: sinceDate }, game: { teamId: coach.teamId } },
      }),
      prisma.coach.findMany({
        where: { teamId: coach.teamId },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.drill.findMany({
        where: { OR: [{ teamId: coach.teamId }, { scope: "library" }], updatedAt: { gt: sinceDate } },
      }),
      // DrillArchive uses replace-all semantics (deletions can't be represented incrementally).
      prisma.drillArchive.findMany({ where: { teamId: coach.teamId } }),
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
      slots,
      players,
      games,
      availabilities,
      assignments,
      gamePeriods,
      coaches,
      drills,
      drillArchives,
      practicePlans,
      practiceBlocks,
      practiceAttendances,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
