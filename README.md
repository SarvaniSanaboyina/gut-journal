# Ashrit's Gut Journal

A private website for tracking Ashrit's meals, poops, and mood.

Entries are stored in a local **PGlite** (Postgres) database on this computer, accessed with **Prisma** through an **Express** API. There is no cloud account.

## Run it

```bash
npm install
npm run dev
```

That starts:

- the Express + Prisma + PGlite API at http://127.0.0.1:8787
- the website (usually http://localhost:5173), which talks to that API

To run only the database server (after `npm run build`, it can also serve the website from `dist/`):

```bash
npm run start
```

After changing `prisma/schema.prisma`, run `npm run prisma:generate`.

## What you can log

- **Meals & snacks** — breakfast through dinner, quantity, consistency, duration, and before/after photos
- **Poop** — time, Bristol stool scale (types 1–7), color, amount, straining/pain/mucus
- **Mood** — happy, calm, energetic, fussy, irritable, tired, or tummy ache
- **Day notes** — sleep, fever, travel, or anything else worth remembering

Today is for logging. Week shows 7-day patterns. History is the full timeline, with backup export/import.
