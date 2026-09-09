import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamCoach, generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const coach = await requireTeamCoach();
    if (coach.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can trigger a password reset" }, { status: 403 });
    }
    const { coachId } = await req.json();
    const target = await prisma.coach.findUnique({ where: { id: coachId } });
    if (!target || target.teamId !== coach.teamId) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const token = generateToken(24);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await prisma.passwordReset.create({ data: { token, coachId: target.id, expiresAt } });

    return NextResponse.json({ token, coachEmail: target.email, expiresAt });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
