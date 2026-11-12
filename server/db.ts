import { PGlite } from '@electric-sql/pglite'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaPGlite } from 'pglite-prisma-adapter'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meals (
  id text PRIMARY KEY,
  date text NOT NULL,
  time text NOT NULL,
  end_time text NOT NULL DEFAULT '',
  type text NOT NULL,
  foods text NOT NULL,
  quantity double precision,
  quantity_unit text NOT NULL,
  consistency text NOT NULL,
  consistency_percent integer,
  notes text NOT NULL DEFAULT '',
  has_before_photo boolean NOT NULL DEFAULT false,
  has_after_photo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poops (
  id text PRIMARY KEY,
  date text NOT NULL,
  time text NOT NULL,
  bristol smallint NOT NULL,
  color text NOT NULL,
  amount text NOT NULL,
  straining boolean NOT NULL DEFAULT false,
  pain boolean NOT NULL DEFAULT false,
  mucus boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moods (
  id text PRIMARY KEY,
  date text NOT NULL,
  time text NOT NULL,
  mood text NOT NULL,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_notes (
  date text PRIMARY KEY,
  note text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_photos (
  meal_id text NOT NULL,
  slot text NOT NULL,
  mime text NOT NULL,
  bytes bytea NOT NULL,
  PRIMARY KEY (meal_id, slot)
);

CREATE INDEX IF NOT EXISTS meals_date_idx ON meals (date, time);
CREATE INDEX IF NOT EXISTS poops_date_idx ON poops (date, time);
CREATE INDEX IF NOT EXISTS moods_date_idx ON moods (date, time);
`

export async function openDatabase(dataDir: string, databaseUrl = process.env.DATABASE_URL) {
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
    try {
      await pool.query(SCHEMA)
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
      return { prisma, kind: 'postgresql', close: () => pool.end() }
    } catch (error) {
      await pool.end()
      throw error
    }
  }
  const pglite = await PGlite.create(dataDir)
  await pglite.exec(SCHEMA)
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pglite) })
  return { prisma, kind: 'pglite', close: () => pglite.close() }
}

export type Database = Awaited<ReturnType<typeof openDatabase>>
