# Lineup Planner

A self-hosted, multi-coach U8 soccer period lineup planner. Plans lineups by
**period**, not minutes — there is no game clock anywhere in this app. It's
built to be usable one-handed on a phone at a field with unreliable signal:
every screen is local-first (reads from IndexedDB, writes queue and sync in
the background) and installable as a PWA.

## Stack

Next.js (App Router) + TypeScript + Tailwind, PostgreSQL via Prisma, no
external services (no SMTP, no analytics, no CDN fonts/scripts).

## Server setup

Requirements: a Linux host with Docker and Docker Compose, and an existing
reverse proxy (nginx, Caddy, Traefik, etc.) that terminates TLS and forwards
to this container's port 3000. This app does not handle TLS itself.

1. Clone the repo onto your server and `cd` into it.
2. Copy the environment template and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `POSTGRES_PASSWORD`: pick a real password.
   - `DATABASE_URL`: update the password to match if you changed it.
   - `SESSION_SECRET`: generate one with `openssl rand -hex 32` (not currently
     used to sign anything sensitive, but keep it private and stable).
3. Build and start:
   ```bash
   docker compose up -d --build
   ```
   This starts Postgres (with a named volume for data) and the app, which
   runs its own database migrations automatically on boot before serving
   traffic on port 3000.
4. Point your reverse proxy at `http://<this-host>:3000`.

### First-run admin creation

There is no seeded admin account in production. Open the app in a browser
and use **Create a team** (`/signup`) — the first person to do this becomes
the team's `owner`. Every other coach joins later with the 8-character join
code shown on the team's Settings page.

To load a demo team instead (11 players, two sample games) for evaluation:

```bash
docker compose exec app node -e "require('child_process').execSync('npx tsx prisma/seed.ts', {stdio:'inherit'})"
```

or, when developing locally outside Docker: `npm run seed`. This creates
**coach@example.com / coachdemo123**, join code **DEMO1234**. Do not run the
seed script against a database you care about a second time in a way that
could collide with real data — it's meant for a fresh instance.

## Local development

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local Postgres, e.g. via
                        # `docker compose up db -d`
npx prisma migrate dev
npm run seed            # optional demo data
npm run dev
```

Run the fairness-engine unit tests with `npm test`.

## Backing up the database

All state lives in the `lineup_pgdata` named Docker volume. To take a
logical SQL dump you can restore later with `psql`:

```bash
docker compose exec -T db pg_dump -U lineup lineup > backup-$(date +%F).sql
```

Restore into a fresh instance with:

```bash
docker compose exec -T db psql -U lineup lineup < backup-2026-01-01.sql
```

For a full binary copy of the volume (faster, but tied to the same Postgres
major version), stop the stack first:

```bash
docker compose stop
docker run --rm -v lineup-planner_lineup_pgdata:/from -v "$PWD":/to alpine \
  tar czf /to/pgdata-backup-$(date +%F).tar.gz -C /from .
docker compose start
```

Take a backup before every upgrade.

## Upgrading

```bash
git pull
docker compose up -d --build
```

The app container runs `prisma migrate deploy` automatically on startup, so
schema changes apply before the new version starts serving traffic. Take a
database backup first (see above) in case a migration needs to be rolled
back.

## How the data model maps to the rules

- **Team** is the sharing unit: a name, a rotating 8-character join code, and
  settings (`playersOnField`, `defaultPeriodCount`, and an ordered position
  slot template like `GK, D, D, D, M, M, M, F`, each slot tagged with a
  fairness `group` of `GK` / `D` / `M` / `F`).
- **Player** records are entered once per season and carry across every
  game; marking a player inactive keeps their history intact.
- **Game** holds a period count (defaulted from team settings, editable per
  game) and a status (`planned` → `in_progress` → `final`).
- **Availability** is per game, per player (`available` / `absent` / `late`).
- **Assignment** rows are `(game, period, slot) → player | null`. A slot with
  no player is that player's bench for that period. Each assignment exists
  in two layers: the **plan** (the pre-game draft you can freely edit and
  re-run auto-fill against) and the **actual** (frozen once you complete a
  period during Live mode). Season fairness totals and the auto-fill engine
  are always computed from **actual**, completed-period data — a draft plan
  never influences fairness math until it's actually been played.

## Offline behavior

Every (app) page is a client component that reads from IndexedDB first and
reconciles with the server in the background — cold-loading the app with no
network still renders the roster and the current game plan, as long as
you've opened that page at least once while online (a service worker caches
both the page shell and its data). All writes apply optimistically to
IndexedDB immediately, get a client-generated id/timestamp/coach id, and are
queued for the server; the sync indicator in the header shows
synced / N pending / offline. Conflicts resolve last-write-wins **per
field** (via a `fieldTimestamps` map on `Player` and `Game`), so two coaches
editing different periods of the same game — or different fields of the
same game — both survive.

## Auto-fill engine

`src/lib/autofill.ts` is a deterministic greedy fill (one period at a time,
scored against season-to-date totals) followed by a bounded local-search
improvement pass over swap candidates — no randomness, so identical inputs
always produce identical output. It respects manual overrides: a second
"Auto-fill empty" pass never touches a slot you've already set by hand, and
the objective priority order (equal periods played, no back-to-back bench,
GK rotation, position-group spread, no consecutive same group) is encoded as
a strictly-decreasing weighted penalty score. Unit tests live in
`src/lib/__tests__/autofill.test.ts`, covering equal-period distribution, GK
rotation rules, no-back-to-back-bench, manual-override preservation, and
awkward roster sizes (9, 10, 13 available players against 8 field slots).

## Practice Planner

The Practice tab is a separate, **minute-based** planning tool - it shares
only the Team and Player tables with the period-based game side and never
mixes minutes into game planning or periods into practice planning. There's
no live/timer mode; a plan is something you build ahead of time and read off
your phone at the field.

- **Drill** rows are either `scope: "library"` (`teamId` is `null`, shared
  read-only across every team, seeded automatically by the practice-module
  migration) or `scope: "team"` (created by a coach, editable and
  permanently deletable by that team only). Forking a library drill creates
  a full `scope: "team"` copy with `sourceDrillId` pointing at the original,
  so it can be freely customized without touching the shared row.
- **DrillArchive** is a per-team hide marker for library drills (`archived`
  on `Drill` itself is used instead for a team's own drills), so archiving a
  shared drill on one team never affects any other team.
- **PracticePlan** holds a `targetMinutes` (defaulting from `Team.
  targetMinutes`, itself defaulting to 30) and an ordered list of
  **PracticeBlock** rows (`drill` / `break` / `talk` / `free_play`), each
  with its own `plannedMinutes`. A block's start offset is just the running
  sum of every earlier block's minutes - nothing about wall-clock time is
  stored.
- Permanently deleting a drill is owner-only and blocked server-side
  (`DELETE /api/drills/:id`) if any `PracticeBlock` still references it;
  archiving is the reversible default everyone else gets.

### Drill JSON import/export schema

The drill library's Import/Export screen (`/practice/drills/import-export`)
is the supported way to bulk-manage a team's own drills - there's no
supported path that edits seed files, scripts, or the database directly.
Export downloads the team's own (`scope: "team"`) drills as a JSON array;
import accepts a JSON array of the same shape and creates one new
team-scoped drill per entry (imported drills are always created fresh, even
if re-importing a previously-exported file - ids are never reused).

Each array entry:

```json
{
  "name": "Cone Gates",
  "category": "technical",
  "focusAreas": ["dribbling", "spatial_awareness"],
  "defaultMinutes": 8,
  "minMinutes": 5,
  "maxMinutes": 12,
  "minPlayers": 5,
  "maxPlayers": null,
  "equipment": ["Balls (one per player)", "10+ pairs of cones"],
  "setup": "Scatter ten two-cone gates around the space.",
  "instructions": "Each player dribbles through as many gates as possible in 60 seconds...",
  "coachingPoints": ["Head up between gates", "Push the ball with the inside of your foot..."],
  "progressions": ["Must use a different gate each time", "Weak foot only"],
  "ageNotes": ""
}
```

Field rules:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Non-empty string. |
| `category` | yes | One of `warmup`, `technical`, `small_sided_game`, `fun_finisher`. |
| `defaultMinutes` | yes | Positive integer. |
| `focusAreas` | no | Array of `dribbling`, `passing`, `shooting`, `defending`, `first_touch`, `spatial_awareness`, `fitness_disguised`. Defaults to `[]`. |
| `minMinutes` / `maxMinutes` | no | Integer or `null`. Soft floor/ceiling used by validation warnings and auto-balance, not enforced on the stepper. |
| `minPlayers` / `maxPlayers` | no | Integer or `null`. |
| `equipment` / `coachingPoints` / `progressions` | no | Arrays of strings, shown in that order (coaching points and progressions are ordered lists, not sets). Default to `[]`. |
| `setup` / `instructions` / `ageNotes` | no | Free text. Default to `""`. |

An entry missing `name`, `category`, or `defaultMinutes`, or with a
`category` outside the four listed above, is rejected - the import screen
lists which entries failed and why without importing any of them, so you
can fix the file and retry.
