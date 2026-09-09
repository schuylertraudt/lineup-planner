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
