import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const coach = await requireTeamCoach();
    const plan = await prisma.practicePlan.findUnique({ where: { id: params.id } });
    if (!plan || plan.teamId !== coach.teamId) {
      return NextResponse.json({ error: "Practice plan not found" }, { status: 404 });
    }
    // PracticeBlock and PracticeAttendance rows both cascade-delete with the plan.
    await prisma.practicePlan.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
