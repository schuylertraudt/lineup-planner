import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const SESSION_COOKIE = "lineup_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(coachId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { token, coachId, expiresAt },
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookies().delete(SESSION_COOKIE);
}

export type CurrentCoach = {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId: string | null;
};

export async function getCurrentCoach(): Promise<CurrentCoach | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { coach: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { coach } = session;
  return {
    id: coach.id,
    email: coach.email,
    name: coach.name,
    role: coach.role,
    teamId: coach.teamId,
  };
}

export async function requireCoach(): Promise<CurrentCoach> {
  const coach = await getCurrentCoach();
  if (!coach) {
    throw new Error("UNAUTHENTICATED");
  }
  return coach;
}

export async function requireTeamCoach(): Promise<CurrentCoach & { teamId: string }> {
  const coach = await requireCoach();
  if (!coach.teamId) {
    throw new Error("NO_TEAM");
  }
  return coach as CurrentCoach & { teamId: string };
}
