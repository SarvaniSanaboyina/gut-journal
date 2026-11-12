# Gut journal

A private website for tracking meals, poops, water, and mood.

Entries are accessed with **Prisma** through an **Express** API. By default, the app uses a local **PGlite** database. Set `DATABASE_URL` to use a Postgres server instead.

## Run it

```bash
pnpm install
pnpm dev
```

That starts:

- the Express + Prisma + PGlite API at http://127.0.0.1:8787
- the website (usually http://localhost:5173), which talks to that API

To run only the database server (after `pnpm build`, it can also serve the website from `dist/`):

```bash
pnpm start
```

After changing `prisma/schema.prisma`, run `pnpm prisma:generate`.

## Docker deployment

The Docker image builds and serves both the website and API on port 8787. For local PGlite storage, mount a volume so data survives rebuilds.

```bash
docker build -t gut-journal-api .
docker run --rm -p 8787:8787 -v gut-journal-data:/data/pglite gut-journal-api
```

Open http://127.0.0.1:8787. For hosted Postgres, set `DATABASE_URL` as a runtime secret instead of mounting a data volume:

```bash
docker run --rm -p 8787:8787 --env-file /path/to/protected.env gut-journal-api
```

The environment file must contain `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/gut_journal`. Create the empty database first. The app creates its tables on startup. Journal photos are stored in the same database. Existing local PGlite data is not copied automatically; use the journal's export/import tools to transfer it.

`/api/health` checks the database connection. The app has no authentication: publishing it gives visitors read and write access to the journal.

Production runs at https://gut.sarvani.dev on the Hetzner Coolify server. It uses a separate `gut_journal` database in the analytics Postgres instance. DNS and tunnel routes are managed in `~/Documents/personal/ops`.

## What you can log

- **Meals & snacks** — breakfast through dinner, quantity, consistency, duration, and before/after photos
- **Poop** — time, Bristol stool scale (types 1–7), color, amount, straining/pain/mucus
- **Mood** — happy, calm, energetic, fussy, irritable, tired, or tummy ache
- **Day notes** — sleep, fever, travel, or anything else worth remembering

Today is for logging. Reports shows weekly (Monday–Sunday) and monthly (1st–month end) patterns. History is the full timeline, with backup export/import.
