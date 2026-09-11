import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, generateJoinCode, hashPassword } from "@/lib/auth";
import { seedTeamDrillsFromLibrary } from "@/lib/practice/seedTeamDrills";

const DEFAULT_SLOTS = [
  { name: "GK", group: "GK" },
  { name: "D", group: "D" },
  { name: "D", group: "D" },
  { name: "D", group: "D" },
  { name: "M", group: "M" },
  { name: "M", group: "M" },
  { name: "M", group: "M" },
  { name: "F", group: "F" },
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { teamName, email, password, name, seasonLabel } = body ?? {};

  if (!teamName || !email || !password || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.coach.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  let joinCode = generateJoinCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.team.findUnique({ where: { joinCode } });
    if (!clash) break;
    joinCode = generateJoinCode();
  }

  const passwordHash = await hashPassword(password);

  const team = await prisma.team.create({
    data: {
      name: teamName,
      joinCode,
      seasonLabel: seasonLabel ?? "",
      slots: {
        create: DEFAULT_SLOTS.map((s, i) => ({ order: i, name: s.name, group: s.group })),
      },
      coaches: {
        create: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          role: "owner",
        },
      },
    },
    include: { coaches: true },
  });

  const coach = team.coaches[0];
  await seedTeamDrillsFromLibrary(team.id);
  await createSession(coach.id);

  return NextResponse.json({ team: { id: team.id, name: team.name, joinCode: team.joinCode }, coach: { id: coach.id, email: coach.email, name: coach.name, role: coach.role } });
}
