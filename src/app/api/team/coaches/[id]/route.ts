import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const coach = await requireTeamCoach();
    if (coach.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can remove coaches" }, { status: 403 });
    }
    if (params.id === coach.id) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
    }
    const target = await prisma.coach.findUnique({ where: { id: params.id } });
    if (!target || target.teamId !== coach.teamId) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }
    await prisma.coach.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
