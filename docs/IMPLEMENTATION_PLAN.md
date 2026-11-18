# Child Nutrition & Gut Health Tracker — implementation plan

## What already exists

| Area | Current implementation |
| --- | --- |
| Frontend | React 19 + Vite, plain CSS (`src/index.css`), no UI/chart/router library. Bottom tab bar, bottom-sheet `Modal`, `choice` chip buttons. |
| State | `useJournal()` (`src/storage.ts`) loads the whole journal from `GET /api/journal` once and keeps it in React state; every save is an upsert through `src/api.ts`. Analytics are computed client-side from that data. |
| Backend | Express 5 (`server/app.ts`) + Prisma 7. Tables are created on boot with idempotent SQL in `server/db.ts`; `prisma/schema.prisma` mirrors them for the client. PGlite locally, Postgres when `DATABASE_URL` is set. |
| Validation | Hand-written parsers in `server/journal.ts` (`parseDate`, `parseTime`, `oneOf`, …) throwing `HttpError(400)`. |
| Auth | One journal per deployment = one child. The child's name + date of birth (scrypt-hashed) unlock it; session cookie. |
| Time | Entries store the child's local wall-clock `date` (`YYYY-MM-DD`) + `time` (`HH:MM`). |
| Features | Free-text meals (quantity, texture, calories, photos), poops (Bristol, colour, flags), water, mood, day note, weekly/monthly reports, calendar history, JSON backup export/import. |

## Architecture decisions

* **Keep the stack.** No new runtime dependencies: charts are small inline-SVG components; PDF export uses a print stylesheet + the browser's *Save as PDF*.
* **Keep one child per journal.** The existing auth model is "one child, unlocked by their DOB". A `childId` column on every table would be unused; the child profile (sex, date of birth for age references/growth) lives in a `settings` row instead.
* **Keep local wall-clock dates/times** (consistent with existing data and with how parents think about "today"); add `created_at`/`updated_at` everywhere.
* **Extend, don't replace, `meals`.** New meals carry structured `meal_items`; the legacy `foods` text is kept (auto-filled from item names) so old entries still render and old backups still import.
* **Food catalogue in the database.** A built-in catalogue (`server/foodCatalog.ts`) is upserted into `food_items` on boot (`is_custom = false`); parents' custom foods share the table (`is_custom = true`). Nutrients are stored per 100 g, `null` = unknown (never treated as 0).
* **Edit history.** Every update/delete of a record writes the previous version to `record_revisions`, so editing history never silently loses data.
* **Safety copy is centralised** (`src/safety.ts`) so every observation uses "recorded / possible association / consider discussing" wording.

## Data model additions

| Table | Key columns |
| --- | --- |
| `food_items` | id, name, aliases, category, groups[], default_unit, default_qty, grams_per_unit (json), nutrients per 100 g (json, nulls = unknown), nutrient_source (`catalogue`/`label`/`none`), is_custom, created/updated |
| `meal_items` | id, meal_id → meals (cascade), parent_item_id → meal_items (cascade, for composite ingredients), food_item_id → food_items (set null), food_name snapshot, quantity_served, quantity_consumed, unit, consumed_percent, preparation_method, notes, position |
| `meals` (+cols) | source (homemade/packaged/restaurant), preparation, created_at |
| `poops` (+cols) | visible_blood, has_photo, created_at |
| `symptoms` | id, date, time, type, other_label, severity, duration_minutes, notes |
| `food_reactions` | id, symptom_id → symptoms (cascade), food_item_id, meal_id, food_name, consumed date/time, onset date/time, severity, previous_similar, notes |
| `daily_metrics` | date (PK), appetite, energy, sleep_hours, digestion_notes |
| `growth_records` | id, date, weight_kg, height_cm, notes |
| `settings` | key (PK), value json — `child_profile`, `nutrient_references` |
| `record_revisions` | id, entity, entity_id, action, data json, changed_at |

Indexes on every `(date, time)`, `meal_items(meal_id)`, `food_reactions(symptom_id)`.

## Phases

1. **Core meal tracking** — food catalogue (≈80 foods incl. Indian staples, 9 categories, 5 food groups, household units), custom foods, new meal sheet (search, category chips, recent foods, repeat-a-recent-meal, multi-food, served vs consumed + quick %, preparation/source, composite ingredients), meal cards with item breakdown, edit/delete, four-section navigation.
2. **Gut health tracking** — Bristol 1–7 illustrated picker with group descriptions, visible blood + photo, bowel history calendar + timeline, symptom logging (type/severity/duration), daily check-in (appetite, energy, sleep, digestion), food-reaction records with computed time gaps and "happened before" detection, medical-evaluation prompts.
3. **Nutrition analytics** — nutrient estimation from catalogue × consumed grams with explicit *estimated / from label / missing* states, age-based configurable references (ICMR-NIN 2020 defaults), food-group coverage (day + week), diversity, trend-based insights; gut dashboard (day/week/month, date range + symptom filters, SVG charts).
4. **Reports** — food-vs-gut timeline, weekly/monthly/custom reports with period comparison, growth records + WHO 0–5 y percentile estimates (official WHO `anthro` LMS tables), printable/PDF pediatrician report, data export and delete-all.

Each phase ends with `pnpm build`, `pnpm lint`, an API smoke test against a throwaway PGlite database, and a Playwright pass at phone and desktop widths.

## Phase 4 notes

- `growth_records` table (weight 1–60 kg, height 40–150 cm, lying/standing) with revisions, backup and CSV export.
- WHO z-scores/percentiles in `src/growth.ts` use the WHO `anthro` LMS tables (weight-, length/height- and BMI-for-age, 0–1826 days),
  sampled every 7 days into `src/whoTables.ts` by `scripts/who-tables.py`; linear interpolation stays within 0.001 z of the daily tables.
  The restricted method applies beyond ±3 SD for weight and BMI, and a ±0.7 cm correction applies when the measuring position does not match the age.
- Reports tab: Summary (week / month / custom, compared with the previous period), Food & gut timeline (food highlight + "within N h after"), Growth.
- Pediatrician report: full-screen printable sheet; the browser's print dialog saves it as a PDF.
- Your data (☰ menu): JSON backup, CSV exports, and `POST /api/delete-all`, which requires `{ "confirm": "DELETE" }`, wipes all journal data, settings and edit history, and keeps the login.
