import { useMemo } from 'react'
import { formatLongDate, formatTime } from '../dates'
import { foodMap } from '../foods'
import { BRISTOL_TYPES } from '../gut'
import { buildDayIndex, COMPLETION_LABEL, summariseDay } from '../mealSlots'
import { assessDay, CALENDAR_META, calendarState } from '../nutritionAssessment'
import type { JournalData, MealEntry, PoopEntry, SlotType, SymptomEntry, WaterEntry } from '../types'
import { formatTotalMl, formatWater } from '../water'
import { PoopRow, SymptomRow } from './GutEntries'
import { WaterDrop } from './Icons'
import { MealSchedule } from './MealSchedule'
import { NutritionPanel } from './NutritionPanel'

function byTime<T extends { time: string }>(items: T[]) {
  return [...items].sort((a, b) => a.time.localeCompare(b.time))
}

/** Everything recorded for one date, with edit actions, opened from the history calendar. */
export function DayDetail({
  data,
  date,
  onLogSlot,
  onSkipSlot,
  onClearSlot,
  onEditMeal,
  onAddWater,
  onEditWater,
  onAddPoop,
  onEditPoop,
  onEditSymptom,
  onOpenDiary,
}: {
  data: JournalData
  date: string
  onLogSlot: (type: SlotType) => void
  onSkipSlot: (type: SlotType) => void
  onClearSlot: (type: SlotType) => void
  onEditMeal: (meal: MealEntry) => void
  onAddWater: () => void
  onEditWater: (entry: WaterEntry) => void
  onAddPoop: () => void
  onEditPoop: (entry: PoopEntry) => void
  onEditSymptom: (entry: SymptomEntry) => void
  onOpenDiary: () => void
}) {
  const summary = useMemo(() => summariseDay(buildDayIndex(data), date, foodMap(data.foods)), [data, date])
  const { completion, records } = summary
  const calendar = useMemo(
    () => calendarState(completion.status === 'complete', completion.skipped === 5, records.meals, data.foods, data.settings, date),
    [completion, records.meals, data.foods, data.settings, date],
  )
  // Show what is known so far even on an incomplete day; the colour stays "not logged".
  const nutrition = useMemo(
    () => calendar.nutrition ?? (records.meals.length ? assessDay(records.meals, data.foods, data.settings, date) : null),
    [calendar.nutrition, records.meals, data.foods, data.settings, date],
  )
  const waters = byTime(records.waters)
  const poops = byTime(records.poops)
  const symptoms = byTime(records.symptoms)
  const others = records.meals.filter((meal) => meal.type === 'mini-snack')
  const meta = CALENDAR_META[calendar.state]

  return (
    <div className="day-detail">
      <p className="day-detail-date">{formatLongDate(date)}</p>

      <section className="day-summary" aria-label="Daily summary">
        <div className="day-summary-row">
          <span className={`completion-badge ${completion.status}`}>{COMPLETION_LABEL[completion.status]}</span>
          <span className="consumption-chip" style={{ background: meta.color }}>Nutrition: {meta.label.toLowerCase()}</span>
        </div>
        <dl className="day-summary-grid">
          <div><dt>Meals eaten</dt><dd>{completion.eaten}/5</dd></div>
          <div><dt>Skipped</dt><dd>{completion.skipped}/5</dd></div>
          <div><dt>Not logged</dt><dd>{completion.notLogged}/5</dd></div>
          <div><dt>Water</dt><dd>{summary.waterMl == null ? '—' : formatTotalMl(summary.waterMl)}</dd></div>
          <div><dt>Bowel movements</dt><dd>{summary.bowelMovements}</dd></div>
          <div><dt>Symptoms</dt><dd>{symptoms.length ? symptoms.length : '—'}</dd></div>
        </dl>
        <p className="muted-note">Meal tracking (complete or not) is separate from nutrition: a complete day is not necessarily a balanced one.</p>
      </section>

      <NutritionPanel
        state={calendar.state}
        nutrition={nutrition}
        completeNote={
          completion.status === 'not-logged'
            ? 'No meals recorded for this day.'
            : 'Not all five meals are recorded yet, so the day is not assessed (missing meals are not counted as zero). Estimates so far are shown below.'
        }
      />

      <MealSchedule summary={summary} title="Meals" showSummary={false} onLog={onLogSlot} onEditMeal={onEditMeal} onSkip={onSkipSlot} onClearSkip={onClearSlot} />

      {others.length > 0 && (
        <section className="section">
          <div className="section-head"><div><h3>Other food</h3><p>Not part of the five scheduled meals</p></div></div>
          <ul className="slot-foods">
            {others.map((meal) => (
              <li key={meal.id}>
                <button type="button" className="link-btn" onClick={() => onEditMeal(meal)}>{meal.items.map((item) => item.name).join(', ') || meal.foods}</button>
                <small>{formatTime(meal.time)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Water</h3>
            <p>{summary.waterMl == null ? 'No water recorded' : `${formatTotalMl(summary.waterMl)} in ${waters.length} entr${waters.length === 1 ? 'y' : 'ies'}`}</p>
          </div>
          <button className="add-btn" onClick={onAddWater}>+ Add</button>
        </div>
        {waters.length > 0 && (
          <div className="entry-list">
            {waters.map((entry) => (
              <button key={entry.id} className="entry" onClick={() => onEditWater(entry)} aria-label={`Edit or delete ${formatWater(entry.amount, entry.unit)} at ${formatTime(entry.time)}`}>
                <WaterDrop />
                <span>
                  <div className="title">{formatWater(entry.amount, entry.unit)}</div>
                  {entry.notes && <div className="detail">{entry.notes}</div>}
                </span>
                <span className="meta">{formatTime(entry.time)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Bowel movements</h3>
            <p>
              {poops.length === 0
                ? 'None recorded'
                : `${poops.length} recorded · ${poops.map((poop) => `type ${poop.bristol}`).join(', ')}`}
            </p>
          </div>
          <button className="add-btn" onClick={onAddPoop}>+ Add</button>
        </div>
        {poops.length > 0 && (
          <div className="entry-list">
            {poops.map((entry) => <PoopRow key={entry.id} entry={entry} onSelect={() => onEditPoop(entry)} />)}
          </div>
        )}
        {poops.length > 0 && (
          <p className="muted-note">{BRISTOL_TYPES.filter((type) => poops.some((poop) => poop.bristol === type.type)).map((type) => `Type ${type.type}: ${type.hint}`).join(' · ')}</p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Digestive symptoms</h3>
            <p>{symptoms.length ? `${symptoms.length} recorded` : 'None recorded'}</p>
          </div>
        </div>
        {symptoms.length > 0 && (
          <div className="entry-list">
            {symptoms.map((entry) => <SymptomRow key={entry.id} entry={entry} onSelect={() => onEditSymptom(entry)} />)}
          </div>
        )}
      </section>

      <div className="actions">
        <button type="button" className="ghost" onClick={onOpenDiary}>Open this day in the Diary</button>
      </div>
    </div>
  )
}
