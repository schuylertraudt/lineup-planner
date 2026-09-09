import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const coach = await requireTeamCoach();
    if (coach.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can edit the position template" }, { status: 403 });
    }
    const { slots, playersOnField } = await req.json();
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "At least one slot is required" }, { status: 400 });
    }
    if (slots.length !== playersOnField) {
      return NextResponse.json({ error: "Total slots must equal playersOnField" }, { status: 400 });
    }
    for (const s of slots) {
      if (!s.name || !["GK", "D", "M", "F"].includes(s.group)) {
        return NextResponse.json({ error: "Each slot needs a name and a valid group" }, { status: 400 });
      }
    }

    await prisma.$transaction([
      prisma.positionSlot.deleteMany({ where: { teamId: coach.teamId } }),
      prisma.team.update({ where: { id: coach.teamId }, data: { playersOnField } }),
      prisma.positionSlot.createMany({
        data: slots.map((s: { name: string; group: string }, i: number) => ({
          teamId: coach.teamId,
          order: i,
          name: s.name,
          group: s.group,
        })),
      }),
    ]);

    const updated = await prisma.positionSlot.findMany({ where: { teamId: coach.teamId }, orderBy: { order: "asc" } });
    return NextResponse.json({ slots: updated });
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
