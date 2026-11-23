import { PGlite } from '@electric-sql/pglite'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PrismaPGlite } from 'pglite-prisma-adapter'
import { seedFoodCatalog } from './foods.ts'

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
  calories double precision,
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

CREATE TABLE IF NOT EXISTS waters (
  id text PRIMARY KEY,
  date text NOT NULL,
  time text NOT NULL,
  amount double precision NOT NULL,
  unit text NOT NULL,
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
CREATE INDEX IF NOT EXISTS waters_date_idx ON waters (date, time);

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id);

ALTER TABLE meals ADD COLUMN IF NOT EXISTS calories double precision;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT '';
ALTER TABLE meals ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS food_items (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  aliases jsonb NOT NULL DEFAULT '[]',
  category text NOT NULL,
  food_groups jsonb NOT NULL DEFAULT '[]',
  default_unit text NOT NULL,
  default_qty double precision CHECK (default_qty IS NULL OR default_qty >= 0),
  unit_grams jsonb NOT NULL DEFAULT '{}',
  nutrients jsonb NOT NULL DEFAULT '{}',
  nutrient_source text NOT NULL DEFAULT 'none',
  ingredients jsonb NOT NULL DEFAULT '[]',
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_items_custom_idx ON food_items (is_custom);
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS source_note text NOT NULL DEFAULT '';
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS is_reference boolean NOT NULL DEFAULT false;
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS recipe jsonb;

CREATE TABLE IF NOT EXISTS meal_items (
  id text PRIMARY KEY,
  meal_id text NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  parent_item_id text REFERENCES meal_items(id) ON DELETE CASCADE,
  food_item_id text REFERENCES food_items(id) ON DELETE SET NULL,
  food_name text NOT NULL CHECK (length(trim(food_name)) > 0),
  quantity_served double precision CHECK (quantity_served IS NULL OR quantity_served >= 0),
  quantity_consumed double precision CHECK (quantity_consumed IS NULL OR quantity_consumed >= 0),
  unit text NOT NULL,
  consumed_percent smallint CHECK (consumed_percent IS NULL OR consumed_percent BETWEEN 0 AND 300),
  preparation text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0
);

-- Second helpings: eaten may exceed served (up to 3x). Widen the check on existing databases.
ALTER TABLE meal_items DROP CONSTRAINT IF EXISTS meal_items_consumed_percent_check;
ALTER TABLE meal_items ADD CONSTRAINT meal_items_consumed_percent_check CHECK (consumed_percent IS NULL OR consumed_percent BETWEEN 0 AND 300);

CREATE INDEX IF NOT EXISTS meal_items_meal_idx ON meal_items (meal_id);
CREATE INDEX IF NOT EXISTS meal_items_food_idx ON meal_items (food_item_id);

CREATE TABLE IF NOT EXISTS record_revisions (
  id text PRIMARY KEY,
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  data jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_revisions_entity_idx ON record_revisions (entity, entity_id);

ALTER TABLE poops ADD COLUMN IF NOT EXISTS visible_blood boolean NOT NULL DEFAULT false;
ALTER TABLE poops ADD COLUMN IF NOT EXISTS has_photo boolean NOT NULL DEFAULT false;
ALTER TABLE poops ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS symptoms (
  id text PRIMARY KEY,
  date text NOT NULL,
  time text NOT NULL,
  type text NOT NULL,
  other_label text NOT NULL DEFAULT '',
  severity text NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 10080),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS symptoms_date_idx ON symptoms (date, time);

CREATE TABLE IF NOT EXISTS food_reactions (
  id text PRIMARY KEY,
  symptom_id text NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  food_item_id text REFERENCES food_items(id) ON DELETE SET NULL,
  meal_id text REFERENCES meals(id) ON DELETE SET NULL,
  food_name text NOT NULL CHECK (length(trim(food_name)) > 0),
  consumed_date text NOT NULL,
  consumed_time text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  previous_similar text NOT NULL DEFAULT 'unsure' CHECK (previous_similar IN ('yes', 'no', 'unsure')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_reactions_symptom_idx ON food_reactions (symptom_id);
CREATE INDEX IF NOT EXISTS food_reactions_food_idx ON food_reactions (food_item_id);

CREATE TABLE IF NOT EXISTS daily_metrics (
  date text PRIMARY KEY,
  appetite text NOT NULL DEFAULT '',
  energy text NOT NULL DEFAULT '',
  sleep_hours double precision CHECK (sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 24),
  digestion_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_slots (
  date text NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'morning-snack', 'lunch', 'evening-snack', 'dinner')),
  status text NOT NULL CHECK (status IN ('not-eaten')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, meal_type)
);

CREATE TABLE IF NOT EXISTS growth_records (
  id text PRIMARY KEY,
  date text NOT NULL,
  weight_kg double precision CHECK (weight_kg IS NULL OR weight_kg BETWEEN 1 AND 60),
  height_cm double precision CHECK (height_cm IS NULL OR height_cm BETWEEN 40 AND 150),
  position text NOT NULL DEFAULT '' CHECK (position IN ('', 'lying', 'standing')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (weight_kg IS NOT NULL OR height_cm IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS growth_records_date_idx ON growth_records (date);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`

export async function openDatabase(dataDir: string, databaseUrl = process.env.DATABASE_URL) {
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
    try {
      await pool.query(SCHEMA)
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
      await seedFoodCatalog(prisma)
      return { prisma, kind: 'postgresql', close: () => pool.end() }
    } catch (error) {
      await pool.end()
      throw error
    }
  }
  const pglite = await PGlite.create(dataDir)
  await pglite.exec(SCHEMA)
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pglite) })
  await seedFoodCatalog(prisma)
  return { prisma, kind: 'pglite', close: () => pglite.close() }
}

export type Database = Awaited<ReturnType<typeof openDatabase>>
