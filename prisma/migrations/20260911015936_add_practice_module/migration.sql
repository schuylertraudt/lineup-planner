-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "targetMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "Drill" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultMinutes" INTEGER NOT NULL,
    "minMinutes" INTEGER,
    "maxMinutes" INTEGER,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "setup" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "coachingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "progressions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageNotes" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT 'team',
    "sourceDrillId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Drill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillArchive" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "drillId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrillArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticePlan" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "location" TEXT NOT NULL DEFAULT '',
    "targetMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fieldTimestamps" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PracticePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeBlock" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "drillId" TEXT,
    "plannedMinutes" INTEGER NOT NULL,
    "blockNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAttendance" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrillArchive_teamId_drillId_key" ON "DrillArchive"("teamId", "drillId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeAttendance_planId_playerId_key" ON "PracticeAttendance"("planId", "playerId");

-- AddForeignKey
ALTER TABLE "Drill" ADD CONSTRAINT "Drill_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillArchive" ADD CONSTRAINT "DrillArchive_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillArchive" ADD CONSTRAINT "DrillArchive_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePlan" ADD CONSTRAINT "PracticePlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeBlock" ADD CONSTRAINT "PracticeBlock_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PracticePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeBlock" ADD CONSTRAINT "PracticeBlock_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttendance" ADD CONSTRAINT "PracticeAttendance_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PracticePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttendance" ADD CONSTRAINT "PracticeAttendance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Seed shared drill library (scope = library, teamId = NULL, visible to every team).
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-dribble-tag', NULL, 'Dribble Tag', 'dribble-tag', 'warmup', ARRAY['dribbling', 'spatial_awareness']::TEXT[], 6, 4, 10, 4, NULL, ARRAY['Balls (one per player)', 'Cones (grid boundary)']::TEXT[], 'Mark a 20x20 yard grid with cones.', 'Every player has a ball inside the grid. Two taggers, also dribbling, try to tag others. A tagged player does five toe-taps to rejoin.', ARRAY['Keep your head up so you can see!', 'Small touches so the ball stays close', 'Use the inside AND outside of your foot']::TEXT[], ARRAY['Add a third tagger', 'Taggers must tag with their weak foot side']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-traffic-lights', NULL, 'Traffic Lights', 'traffic-lights', 'warmup', ARRAY['first_touch', 'dribbling']::TEXT[], 5, 4, 8, 4, NULL, ARRAY['Balls (one per player)', 'Cones (grid boundary)']::TEXT[], 'Mark a grid sized for your group.', 'Players dribble in the grid. Coach calls green (fast), yellow (slow), red (stop with sole). Add purple (turn) and blue (backward) once they''ve got the basics.', ARRAY['Stop the ball dead on red - trap it!', 'Quick feet on green', 'Look up between touches']::TEXT[], ARRAY['Add purple (180 turn) and blue (dribble backward)', 'Call colors faster']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-sharks-minnows', NULL, 'Sharks and Minnows', 'sharks-and-minnows', 'warmup', ARRAY['dribbling', 'defending']::TEXT[], 6, 5, 10, 5, NULL, ARRAY['Balls (one per minnow)', 'Cones (grid boundary)']::TEXT[], 'Mark a grid. Pick 1-2 sharks to start without balls.', 'Minnows dribble across the grid try to reach the other side without a shark kicking their ball out. Kicked-out minnows become sharks but keep their own ball and rejoin next round.', ARRAY['Shield the ball with your body', 'Change direction to avoid sharks', 'Sharks: stay low and quick']::TEXT[], ARRAY['Start with more sharks', 'Shrink the grid each round']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-body-part-dribble', NULL, 'Body Part Dribble', 'body-part-dribble', 'warmup', ARRAY['dribbling']::TEXT[], 5, 3, 7, 3, NULL, ARRAY['Balls (one per player)', 'Cones (grid boundary)']::TEXT[], 'Any open grid space.', 'Players dribble freely. Coach calls out a body part (knee, elbow, shoulder, sole) and players must stop the ball with it as fast as possible.', ARRAY['Fastest reaction wins the round!', 'Keep the ball close while moving']::TEXT[], ARRAY['Call two body parts in a row', 'Last one to stop does 3 jumping jacks']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-cone-gates', NULL, 'Cone Gates', 'cone-gates', 'technical', ARRAY['dribbling', 'spatial_awareness']::TEXT[], 8, 5, 12, 5, NULL, ARRAY['Balls (one per player)', '10+ pairs of cones']::TEXT[], 'Scatter ten two-cone gates around the space.', 'Each player dribbles through as many gates as possible in 60 seconds, counting out loud as they go. Run three rounds; try to beat your own score each time.', ARRAY['Head up between gates', 'Push the ball with the inside of your foot to change direction quick']::TEXT[], ARRAY['Must use a different gate each time', 'Weak foot only']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-toe-taps-rolls', NULL, 'Toe Taps and Rolls', 'toe-taps-and-rolls', 'technical', ARRAY['first_touch']::TEXT[], 4, 3, 6, 1, NULL, ARRAY['Balls (one per player)']::TEXT[], 'Players spread out, each with their own ball, stationary.', 'Stationary ball mastery: toe taps on top of the ball, sole rolls, inside-outside touches. Keep it short and snappy.', ARRAY['Light touches, not stomps', 'Stay on your toes, knees bent']::TEXT[], ARRAY['Speed up the count', 'Close eyes for 5 taps (advanced only)']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-pass-the-gate', NULL, 'Pass the Gate', 'pass-the-gate', 'technical', ARRAY['passing', 'first_touch']::TEXT[], 7, 5, 10, 2, NULL, ARRAY['Balls (one per pair)', 'Cones (one gate per pair)']::TEXT[], 'Pairs face each other 6 yards apart with a two-cone gate between them.', 'Partners pass through the gate. Every successful pass through the gate, both players step back a yard.', ARRAY['Lock your ankle when you strike the ball', 'Trap it before you pass it back', 'Aim through the middle of the gate']::TEXT[], ARRAY['One-touch passing once close', 'Add a second ball for two-touch relay']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-turn-and-go', NULL, 'Turn and Go', 'turn-and-go', 'technical', ARRAY['dribbling']::TEXT[], 7, 5, 10, 2, NULL, ARRAY['Balls (one per player)', 'Cones (one per player)']::TEXT[], 'One cone per player, spread out.', 'Dribble to your cone, execute a turn (drag back, inside cut, or Cruyff turn), then accelerate away. Demonstrate one turn per session and let players use whichever they like.', ARRAY['Slow down before the cone, explode away after', 'Use the sole or inside of your foot to change direction']::TEXT[], ARRAY['Add a defender applying light pressure', 'Race a partner after the turn']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-shooting-gallery', NULL, 'Shooting Gallery', 'shooting-gallery', 'technical', ARRAY['shooting']::TEXT[], 8, 6, 12, 4, NULL, ARRAY['Balls', '2 small goals (or cone goals)']::TEXT[], 'Two lines feeding two small goals side by side, coach or a helper in the middle.', 'Coach rolls a ball to the front of each line; the player strikes it first-time at goal. Rotate through quickly - never more than three players waiting per line.', ARRAY['Plant foot points at the target', 'Strike through the middle of the ball', 'Follow through toward the goal']::TEXT[], ARRAY['One-touch finish only', 'Add a passive keeper']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-knockout', NULL, 'Knockout', 'knockout', 'technical', ARRAY['dribbling', 'defending']::TEXT[], 7, 5, 10, 5, NULL, ARRAY['Balls (one per player)', 'Cones (grid boundary)']::TEXT[], 'Mark a grid; shrink it as players get knocked out.', 'All players dribble inside the grid, trying to knock others'' balls out while protecting their own. A knocked-out player does ten juggles (or ball taps) and rejoins immediately.', ARRAY['Keep your ball close when others are near', 'Use your body to shield']::TEXT[], ARRAY['Shrink the grid every minute', 'Two touches max']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-1v1-two-goals', NULL, '1v1 to Two Goals', '1v1-to-two-goals', 'small_sided_game', ARRAY['dribbling', 'defending']::TEXT[], 8, 6, 12, 2, NULL, ARRAY['Balls', 'Cones (channel + 2 small goals per channel)']::TEXT[], 'Mark a 10x15 yard channel per pair with a small goal at each end. Use multiple channels so nobody waits.', 'Continuous 1v1 - either player can attack either goal. Coach feeds in a new ball whenever one goes out.', ARRAY['Attacker: change speed to beat your defender', 'Defender: stay on your toes, don''t dive in']::TEXT[], ARRAY['Winner stays, loser rotates', 'Add a neutral 2-yard no-tackle zone around each goal']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-2v2-four-goals', NULL, '2v2 Four Goals', '2v2-four-goals', 'small_sided_game', ARRAY['spatial_awareness', 'passing']::TEXT[], 10, 8, 14, 4, NULL, ARRAY['Balls', 'Cones (4 small goals)']::TEXT[], '20x20 yard grid with a small goal on each side.', '2v2, attack any of the two goals not being defended. Encourages switching the point of attack.', ARRAY['Look for the open goal', 'Spread out - don''t bunch up with your teammate']::TEXT[], ARRAY['Add a third goal option', 'One-touch finish only']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-3v3-no-keepers', NULL, '3v3 No Keepers', '3v3-no-keepers', 'small_sided_game', ARRAY['dribbling', 'passing', 'shooting', 'defending', 'spatial_awareness']::TEXT[], 10, 8, 16, 6, NULL, ARRAY['Balls', 'Small goals (2)', 'Cones (field boundary)']::TEXT[], 'Small field with a small goal at each end, no keepers.', '3v3, small goals. Restart with a roll-in from the sideline (no throw-ins) to keep the ball moving.', ARRAY['Everyone attacks, everyone defends', 'First touch away from pressure']::TEXT[], ARRAY['Add a neutral player who always plays with possession', 'Two-touch max']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-world-cup', NULL, 'World Cup', 'world-cup', 'small_sided_game', ARRAY['shooting', 'fitness_disguised']::TEXT[], 10, 8, 14, 4, NULL, ARRAY['Balls', '1 goal']::TEXT[], 'One goal with a keeper. Pairs line up to challenge.', 'Pairs compete free-for-all to the one goal with a keeper. First pair to score advances; the last pair standing (or the pair that loses) becomes the next round''s keepers.', ARRAY['Work together with your partner', 'Shoot when you have the chance, don''t overpass']::TEXT[], ARRAY['Winners stay on, keep a running champion', '3-touch limit']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-end-zone-game', NULL, 'End Zone Game', 'end-zone-game', 'small_sided_game', ARRAY['dribbling', 'spatial_awareness']::TEXT[], 8, 6, 12, 4, NULL, ARRAY['Balls', 'Cones (field + end zones)']::TEXT[], 'Mark a field with an end zone on each side (like a football end zone).', 'Score by dribbling the ball under control into the opposing end zone - no kicking it in, must be dribbled.', ARRAY['Change speed to get past defenders', 'Keep the ball close in tight spaces']::TEXT[], ARRAY['Must beat a defender 1v1 before scoring', 'Add a neutral end zone defender']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-numbers-game', NULL, 'Numbers Game', 'numbers-game', 'small_sided_game', ARRAY['spatial_awareness', 'fitness_disguised']::TEXT[], 8, 6, 12, 4, NULL, ARRAY['Balls', '1-2 small goals', 'Pinnies or numbers']::TEXT[], 'Two lines facing a goal, each player given a number.', 'Coach calls a number; those two players sprint in for a 1v1 to goal. Call two numbers for a 2v2.', ARRAY['React fast when your number is called', 'First to the ball sets the tone']::TEXT[], ARRAY['Call three numbers for 3v3', 'Coach serves the ball in instead of it starting on the ground']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-free-scrimmage', NULL, 'Free Scrimmage', 'free-scrimmage', 'fun_finisher', ARRAY['dribbling', 'passing', 'shooting', 'defending', 'spatial_awareness']::TEXT[], 8, 5, 15, 6, NULL, ARRAY['Balls', 'Goals or cone goals', 'Pinnies']::TEXT[], 'Split into two teams on a small field.', 'Play a normal scrimmage. No coaching, no stopping play - just let them play. End every practice with this.', ARRAY['Have fun!', 'Try the moves we worked on today']::TEXT[], ARRAY[]::TEXT[], 'Always end practice here.', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-coach-vs-team', NULL, 'Coach vs Team', 'coach-vs-team', 'fun_finisher', ARRAY['fitness_disguised']::TEXT[], 8, 5, 12, 4, NULL, ARRAY['Balls', '1-2 goals']::TEXT[], 'Small field, one goal (or two small goals).', 'The whole team versus the coach (and another adult helper if available). Let them score - a lot.', ARRAY['Everyone gets a turn to try to score on the coach!']::TEXT[], ARRAY['Coach can only use one foot', 'Coach closes their eyes for 3 seconds before defending']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-crossbar-challenge', NULL, 'Crossbar Challenge', 'crossbar-challenge', 'fun_finisher', ARRAY['shooting']::TEXT[], 4, 3, 6, 1, NULL, ARRAY['Balls', '1 goal']::TEXT[], 'Balls lined up 8-10 yards from goal.', 'Everyone tries to hit the crossbar (or post). Cheer every close one.', ARRAY['Aim high and strike through the bottom of the ball']::TEXT[], ARRAY['Move back for older/stronger kickers']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Drill" ("id", "teamId", "name", "slug", "category", "focusAreas", "defaultMinutes", "minMinutes", "maxMinutes", "minPlayers", "maxPlayers", "equipment", "setup", "instructions", "coachingPoints", "progressions", "ageNotes", "scope", "updatedAt") VALUES ('lib-penalty-shootout', NULL, 'Penalty Shootout', 'penalty-shootout', 'fun_finisher', ARRAY['shooting']::TEXT[], 4, 3, 8, 3, NULL, ARRAY['Balls', '1 goal']::TEXT[], 'Standard penalty spot (or a cone) in front of goal.', 'Every player takes one penalty kick. Rotate who''s in goal each round.', ARRAY['Pick your spot before you run up', 'Keepers: stay big, don''t guess early']::TEXT[], ARRAY['Sudden-death rounds', 'Non-kicking foot only']::TEXT[], '', 'library', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
