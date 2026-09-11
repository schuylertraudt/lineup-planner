import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

/**
 * Permanent delete. Only a team owner can do this, and only for a drill their
 * own team created - library drills can only ever be archived (via
 * DrillArchive), never deleted, since they're shared across every team.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const coach = await requireTeamCoach();
    if (coach.role !== "owner") {
      return NextResponse.json({ error: "Only the team owner can permanently delete a drill." }, { status: 403 });
    }

    const drill = await prisma.drill.findUnique({ where: { id: params.id } });
    if (!drill || drill.teamId !== coach.teamId) {
      return NextResponse.json({ error: "Drill not found" }, { status: 404 });
    }
    if (drill.scope === "library") {
      return NextResponse.json({ error: "Library drills can only be archived, not deleted." }, { status: 400 });
    }

    const referencedCount = await prisma.practiceBlock.count({ where: { drillId: params.id } });
    if (referencedCount > 0) {
      return NextResponse.json(
        { error: "This drill is used in one or more practice plans and can't be permanently deleted. Archive it instead." },
        { status: 409 }
      );
    }

    await prisma.drill.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
