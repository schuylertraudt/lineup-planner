import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";
import { DEFAULT_SLOTS } from "@/lib/defaultSlots";

/**
 * Creates a brand-new season (blank roster, default position template) and
 * switches the team to it. A dedicated online-only route, not the generic
 * offline mutate queue, because it has to atomically seed the season's
 * position slots too - the same reason signup seeds a new team's slots
 * server-side rather than relying on the client to sequence it.
 */
export async function POST(req: NextRequest) {
  try {
    const coach = await requireTeamCoach();
    if (coach.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can create a new season" }, { status: 403 });
    }
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "A season name is required" }, { status: 400 });
    }

    const seasonId = randomUUID();
    await prisma.season.create({
      data: {
        id: seasonId,
        teamId: coach.teamId,
        name: name.trim(),
        playersOnField: DEFAULT_SLOTS.length,
        slots: { create: DEFAULT_SLOTS.map((s, i) => ({ order: i, name: s.name, group: s.group })) },
      },
    });
    await prisma.team.update({ where: { id: coach.teamId }, data: { currentSeasonId: seasonId } });

    return NextResponse.json({ seasonId });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
