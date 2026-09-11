-- The previous migration (detach_drills_per_team) gave every team its own
-- copy of each starter drill, but never repointed existing PracticeBlock
-- rows that still referenced the old shared scope:"library" template
-- drills. Since the pull route only ever returns a team's own drills,
-- those blocks were left pointing at ids the client can never see again -
-- they'd silently render as a bare "Drill" with no name. Repoint each such
-- block to that plan's own team's copy of the same starter drill, matched
-- by slug (the backfilled copies don't carry sourceDrillId, so slug is the
-- only stable link back to which template they came from).
UPDATE "PracticeBlock" pb
SET "drillId" = repl.id
FROM "Drill" tmpl, "PracticePlan" plan, "Drill" repl
WHERE pb."drillId" = tmpl.id
  AND tmpl.scope = 'library'
  AND plan.id = pb."planId"
  AND repl."teamId" = plan."teamId"
  AND repl.scope = 'team'
  AND repl.slug = tmpl.slug
  AND tmpl.slug != '';
