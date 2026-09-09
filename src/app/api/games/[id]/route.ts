import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const coach = await requireTeamCoach();
    const game = await prisma.game.findUnique({ where: { id: params.id } });
    if (!game || game.teamId !== coach.teamId) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    // Availability, Assignment, and GamePeriod rows all cascade-delete with the game.
    await prisma.game.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
