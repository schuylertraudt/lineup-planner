import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();
  if (!token || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.used || reset.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.coach.update({ where: { id: reset.coachId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { token }, data: { used: true } }),
    prisma.session.deleteMany({ where: { coachId: reset.coachId } }),
  ]);

  return NextResponse.json({ ok: true });
}
