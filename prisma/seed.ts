import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

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

const PLAYER_NAMES: [string, string, string][] = [
  ["Ava", "T", "1"],
  ["Ben", "K", "2"],
  ["Carter", "M", "3"],
  ["Dana", "R", "4"],
  ["Ellis", "P", "5"],
  ["Finn", "O", "6"],
  ["Grace", "L", "7"],
  ["Harper", "S", "8"],
  ["Ivy", "N", "9"],
  ["Jonah", "W", "10"],
  ["Kai", "B", "11"],
];

async function main() {
  const existing = await prisma.team.findFirst({ where: { name: "Demo Sharks U8" } });
  if (existing) {
    console.log("Demo team already exists, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("coachdemo123", 10);

  const team = await prisma.team.create({
    data: {
      name: "Demo Sharks U8",
      joinCode: "DEMO1234",
      seasonLabel: "Fall Demo Season",
      playersOnField: 8,
      defaultPeriodCount: 4,
      slots: { create: DEFAULT_SLOTS.map((s, i) => ({ order: i, name: s.name, group: s.group })) },
      coaches: {
        create: { email: "coach@example.com", passwordHash, name: "Coach Sam", role: "owner" },
      },
    },
    include: { slots: { orderBy: { order: "asc" } } },
  });

  const players = [];
  for (let i = 0; i < PLAYER_NAMES.length; i++) {
    const [firstName, lastNameInitial, jerseyNumber] = PLAYER_NAMES[i];
    const player = await prisma.player.create({
      data: { id: randomUUID(), teamId: team.id, firstName, lastNameInitial, jerseyNumber, order: i },
    });
    players.push(player);
  }

  const slots = team.slots;

  // Game 1: final, with a completed, fairly-distributed actual record.
  const game1Id = randomUUID();
  const game1Date = new Date();
  game1Date.setDate(game1Date.getDate() - 7);
  await prisma.game.create({
    data: {
      id: game1Id,
      teamId: team.id,
      date: game1Date,
      opponent: "Riverside FC",
      location: "Field 3",
      periodCount: 4,
      status: "final",
      notes: "",
    },
  });

  // 9 of 11 players available; rotate bench and GK across periods.
  const availableForGame1 = players.slice(0, 9);
  for (const p of players) {
    await prisma.availability.create({
      data: {
        id: `${game1Id}:${p.id}`,
        gameId: game1Id,
        playerId: p.id,
        status: availableForGame1.includes(p) ? "available" : "absent",
      },
    });
  }

  const game1Plan: string[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [1, 2, 3, 4, 5, 6, 7, 8],
    [2, 3, 4, 5, 6, 7, 8, 0],
    [3, 4, 5, 6, 7, 8, 0, 1],
  ].map((row) => row.map((idx) => availableForGame1[idx].id));

  for (let period = 0; period < 4; period++) {
    await prisma.gamePeriod.create({
      data: {
        id: `${game1Id}:${period + 1}`,
        gameId: game1Id,
        periodNumber: period + 1,
        status: "completed",
        startedAt: game1Date,
        completedAt: game1Date,
      },
    });
    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      const playerId = game1Plan[period][slotIdx];
      for (const isActual of [false, true]) {
        await prisma.assignment.create({
          data: {
            id: `${game1Id}:${period + 1}:${slotIdx}:${isActual ? "actual" : "plan"}`,
            gameId: game1Id,
            periodNumber: period + 1,
            slotIndex: slotIdx,
            playerId,
            isActual,
          },
        });
      }
    }
  }

  // Game 2: upcoming, planned only, ready for auto-fill / manual editing.
  const game2Id = randomUUID();
  const game2Date = new Date();
  game2Date.setDate(game2Date.getDate() + 7);
  await prisma.game.create({
    data: {
      id: game2Id,
      teamId: team.id,
      date: game2Date,
      opponent: "Lakeside United",
      location: "Field 1",
      periodCount: 4,
      status: "planned",
      notes: "",
    },
  });
  for (const p of players) {
    await prisma.availability.create({
      data: { id: `${game2Id}:${p.id}`, gameId: game2Id, playerId: p.id, status: "available" },
    });
  }

  console.log("Seeded demo team:");
  console.log("  Login: coach@example.com / coachdemo123");
  console.log("  Join code: DEMO1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
