import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const coach = await prisma.coach.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!coach || !(await verifyPassword(password, coach.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(coach.id);
  return NextResponse.json({
    coach: { id: coach.id, email: coach.email, name: coach.name, role: coach.role, teamId: coach.teamId },
  });
}
