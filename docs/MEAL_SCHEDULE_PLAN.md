# Daily meal schedule & calendar history — design

> **Update:** calendar colours are now based on nutrient intake, not on the share of served food eaten. See `NUTRITION_ASSESSMENT.md`. The consumption share described below is still used as an eating-habit metric in reports.

## What exists today

- **Journal and child:** one journal per child, so there is no `childId` column anywhere. Each database belongs to one child.
  "Per child" uniqueness is therefore "per date".
- **Meals (`meals` + `meal_items`):**
  - Each meal has a `type`, one of breakfast, morning-snack, lunch, evening-snack, dinner and mini-snack ("Other").
  - Several entries can share a type and date.
  - Items record served and eaten amounts per food (`quantity_served`, `quantity_consumed`, `consumed_percent`).
- **Water (`waters`):** a table separate from foods. Milk and juice are logged as foods in meals. Entries have amount + unit (ml, sips or cups), a date and a time, and support add, edit and delete. The form has 50–250 ml presets and a custom amount.
- **Bowel movements (`poops`):** one row per movement, with a Bristol type.
- **Dates:** every record stores a local wall-clock `date` (YYYY-MM-DD) and `time`, so grouping by date already follows the user's local calendar day.
- **History calendar:** `HistoryView` uses a hand-made month grid (no calendar library). It shows one dot per logged day, and the selected day's entries appear below the grid.

## Data model changes

| Change | Why |
|---|---|
| New `meal_slots` table: `date`, `meal_type` (5 scheduled types only), `status` (`not-eaten`), `note`, `created_at`, `updated_at`; primary key `(date, meal_type)` | Stores the parent's explicit "Not eaten". |
| `calendar-thresholds` setting `{ lessBelow: 50, moreAbove: 100 }` | Configurable colour thresholds. |
| Water `amount` may be 0 | "Explicitly recorded zero" is distinct from "no entry". |
| An item's eaten amount may exceed served, up to 3× | "More than usual" (>100 %) is otherwise impossible. Second helpings were previously added to "served". |

### How each slot status is worked out

The five slots for a date are **computed, not stored**. A row is stored only for an explicit Not eaten.

- A meal entry exists for (date, type) → **Eaten**.
- A `meal_slots` row with `not-eaten` exists → **Not eaten**.
- Otherwise → **Not logged**. Nothing is ever filled in automatically.

Switching between states keeps them consistent:

- **Saving a meal** for a slot deletes its Not eaten row, in the same transaction.
- **Marking a slot Not eaten** is refused while meals exist for it, unless the parent confirms. The meals are then deleted, and a revision is recorded for each.

"Other" meals still count for nutrition, but are not one of the five slots.

## Calculations (`src/mealSlots.ts`)

### Daily completion

| State | Rule |
|---|---|
| Complete | All five slots are Eaten or Not eaten. |
| Not logged | All five slots are Not logged. |
| Incomplete | Anything in between. |

### Slot consumption

- Eaten items convert to grams where the food's weight is known. If all items in the slot convert, the slot's percentage is eaten ÷ served by weight. Otherwise each item counts as one portion, using its eaten percentage.
- A Not eaten slot counts as 0 %.
- An Eaten slot whose amounts were never recorded has an unknown percentage.

### Day consumption

The day's percentage is the average of the five slot percentages, so every scheduled slot counts as one portion.

Calendar state, checked in this order:

1. Any slot Not logged → **red** (Not logged). No percentage is shown, so a misleading one is never computed.
2. All five slots Not eaten → **grey**.
3. Any Eaten slot without recorded amounts → a hatched "amounts not recorded" state.
4. Otherwise the thresholds apply: below 50 % yellow, 50–100 % green, above 100 % blue.

### Water and bowel movements

- **Water:** the sum of the day's entries in ml. No entries → "–". Entries totalling 0 → "0 ml".
- **Bowel movements:** the count of the day's entries. The calendar shows one dot when the count is 1 or more.

## UI changes

- **Meal form:** a "Not eaten" action for the five slot types, and a "More" quick choice (150 %) for seconds.
- **Diary:** a "Today's meals" card listing the five slots with their status, plus a prominent completion badge and eaten / skipped / not-logged counts. Each slot has quick actions: Log, Not eaten, Edit.
- **Water form:** a "None today (0 ml)" choice.
- **History calendar:** the cell background shows consumption state, with the ml total under the date number and a bowel-movement dot below it. A legend sits above the grid, with editable thresholds.
  - Tapping a date opens a day-detail sheet with the meal slots, water, bowel movements, symptoms and a daily summary. Every item in it is editable.
- **Reports:**
  - Meal tracking: complete, incomplete and no-log days, average eaten and skipped per day, skipped count per slot, and a consumption trend.
  - Hydration: average ml over days that have water records, a trend chart, and days with no record.
  - Bowel movements: days with records, average per tracked day, and the type distribution.
