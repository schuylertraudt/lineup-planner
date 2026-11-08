-- Introduce Season, owning each team's roster, position template, and games.
-- Every existing team gets exactly one backfilled season (named from its old
-- seasonLabel, falling back to the team name) holding all of its existing
-- players/slots/games, set as that team's current season.

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "playersOnField" INTEGER NOT NULL DEFAULT 8,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one season per existing team.
INSERT INTO "Season" ("id", "teamId", "name", "playersOnField", "archived", "createdAt", "updatedAt")
SELECT 'season-' || "id", "id", COALESCE(NULLIF("seasonLabel", ''), "name"), "playersOnField", false, "createdAt", CURRENT_TIMESTAMP
FROM "Team";

-- AlterTable: Team gets currentSeasonId (plain scalar, no DB-level relation -
-- same pattern as Drill.sourceDrillId), drops the fields that moved to Season.
ALTER TABLE "Team" ADD COLUMN "currentSeasonId" TEXT;
UPDATE "Team" SET "currentSeasonId" = 'season-' || "id";
ALTER TABLE "Team" DROP COLUMN "seasonLabel";
ALTER TABLE "Team" DROP COLUMN "playersOnField";

-- AlterTable: Player moves from teamId to seasonId.
ALTER TABLE "Player" ADD COLUMN "seasonId" TEXT;
UPDATE "Player" SET "seasonId" = 'season-' || "teamId";
ALTER TABLE "Player" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Player" DROP CONSTRAINT "Player_teamId_fkey";
ALTER TABLE "Player" DROP COLUMN "teamId";
ALTER TABLE "Player" ADD CONSTRAINT "Player_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Game moves from teamId to seasonId.
ALTER TABLE "Game" ADD COLUMN "seasonId" TEXT;
UPDATE "Game" SET "seasonId" = 'season-' || "teamId";
ALTER TABLE "Game" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Game" DROP CONSTRAINT "Game_teamId_fkey";
ALTER TABLE "Game" DROP COLUMN "teamId";
ALTER TABLE "Game" ADD CONSTRAINT "Game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: PositionSlot moves from teamId to seasonId, including its
-- per-scope uniqueness on order.
ALTER TABLE "PositionSlot" ADD COLUMN "seasonId" TEXT;
UPDATE "PositionSlot" SET "seasonId" = 'season-' || "teamId";
ALTER TABLE "PositionSlot" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "PositionSlot" DROP CONSTRAINT "PositionSlot_teamId_fkey";
DROP INDEX "PositionSlot_teamId_order_key";
ALTER TABLE "PositionSlot" DROP COLUMN "teamId";
ALTER TABLE "PositionSlot" ADD CONSTRAINT "PositionSlot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "PositionSlot_seasonId_order_key" ON "PositionSlot"("seasonId", "order");
