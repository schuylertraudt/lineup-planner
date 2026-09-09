import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { joinCode, email, password, name } = await req.json();
  if (!joinCode || !email || !password || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { joinCode: String(joinCode).toUpperCase() } });
  if (!team) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  const existing = await prisma.coach.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const coach = await prisma.coach.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: "coach", teamId: team.id },
  });

  await createSession(coach.id);
  return NextResponse.json({
    team: { id: team.id, name: team.name },
    coach: { id: coach.id, email: coach.email, name: coach.name, role: coach.role, teamId: coach.teamId },
  });
}
