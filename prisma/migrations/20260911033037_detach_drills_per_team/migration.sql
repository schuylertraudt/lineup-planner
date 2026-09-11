-- Give every existing team its own editable/deletable copy of each starter
-- drill it doesn't already have (skipping ones it already forked via
-- "Copy & customize", matched by sourceDrillId), before the per-team hide
-- mechanism (DrillArchive) is dropped. A drill a team had archived comes
-- back already archived, so nothing changes from that coach's point of view.
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "archived", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t.id,
  d.name,
  d.slug,
  d.category,
  d."focusAreas",
  d."defaultMinutes",
  d."minMinutes",
  d."maxMinutes",
  d."minPlayers",
  d."maxPlayers",
  d.equipment,
  d.setup,
  d.instructions,
  d."coachingPoints",
  d.progressions,
  d."ageNotes",
  'team',
  EXISTS (SELECT 1 FROM "DrillArchive" da WHERE da."teamId" = t.id AND da."drillId" = d.id),
  CURRENT_TIMESTAMP
FROM "Team" t
CROSS JOIN "Drill" d
WHERE d.scope = 'library'
  AND NOT EXISTS (
    SELECT 1 FROM "Drill" existing
    WHERE existing."teamId" = t.id AND existing."sourceDrillId" = d.id
  );

-- DropForeignKey
ALTER TABLE "DrillArchive" DROP CONSTRAINT "DrillArchive_drillId_fkey";

-- DropForeignKey
ALTER TABLE "DrillArchive" DROP CONSTRAINT "DrillArchive_teamId_fkey";

-- DropTable
DROP TABLE "DrillArchive";
