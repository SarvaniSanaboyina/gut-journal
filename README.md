# Ashrit's Gut Journal

A private website for tracking Ashrit's meals, poops, and mood.

Entries are stored in a local **PGlite** (Postgres) database on this computer, accessed with **Prisma** through an **Express** API. There is no cloud account.

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

## Backend Docker image

The API (Express + Prisma + PGlite) can run in Docker. Journal data lives in a volume so it survives rebuilds.

```bash
docker build -t gut-journal-api .
docker run --rm -p 8787:8787 -v gut-journal-data:/data/pglite gut-journal-api
```

Then open the website with `pnpm dev:web`, or call http://127.0.0.1:8787/api/health.

## What you can log

- **Meals & snacks** — breakfast through dinner, quantity, consistency, duration, and before/after photos
- **Poop** — time, Bristol stool scale (types 1–7), color, amount, straining/pain/mucus
- **Mood** — happy, calm, energetic, fussy, irritable, tired, or tummy ache
- **Day notes** — sleep, fever, travel, or anything else worth remembering

Today is for logging. Week shows 7-day patterns. History is the full timeline, with backup export/import.
