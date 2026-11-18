import { useMemo } from 'react'
import { moodMeta } from '../constants'
import { bristolGroup, bristolGroupMeta } from '../gut'
import { careNotices } from '../safety'
import { formatTime } from '../dates'
import { formatCalories, hasCalories, totalCalories } from '../meals'
import { summariseDate } from '../mealSlots'
import type { JournalData, MealEntry, MoodEntry, PoopEntry, SlotType, SymptomEntry, WaterEntry } from '../types'
import { formatTotalMl, formatWater, totalWaterMl } from '../water'
import { CareNotices, PoopRow, SymptomRow } from './GutEntries'
import { MoodFace, WaterDrop } from './Icons'
import { MealCard } from './MealCard'
import { MealSchedule } from './MealSchedule'

function byTime<T extends { time: string }>(items: T[]) {
  return [...items].sort((a, b) => a.time.localeCompare(b.time))
}

export function TodayView({
  date,
  name,
  data,
  onAddMeal,
  onAddPoop,
  onAddMood,
  onAddWater,
  onAddSymptom,
  onCheckIn,
  onEditSymptom,
  onEditMeal,
  onEditPoop,
  onEditMood,
  onEditWater,
  onNoteChange,
  onNoteBlur,
  onLogSlot,
  onSkipSlot,
  onClearSlot,
}: {
  date: string
  name: string
  data: JournalData
  onAddMeal: () => void
  onAddPoop: () => void
  onAddMood: () => void
  onAddWater: () => void
  onAddSymptom: () => void
  onCheckIn: () => void
  onEditSymptom: (entry: SymptomEntry) => void
  onEditMeal: (entry: MealEntry) => void
  onEditPoop: (entry: PoopEntry) => void
  onEditMood: (entry: MoodEntry) => void
  onEditWater: (entry: WaterEntry) => void
  onNoteChange: (note: string) => void
  onNoteBlur: () => void
  onLogSlot: (type: SlotType) => void
  onSkipSlot: (type: SlotType) => void
  onClearSlot: (type: SlotType) => void
}) {
  const daySummary = useMemo(() => summariseDate(data, date), [data, date])
  const meals = byTime(data.meals.filter((item) => item.date === date))
  const poops = byTime(data.poops.filter((item) => item.date === date))
  const moods = byTime(data.moods.filter((item) => item.date === date))
  const waters = byTime((data.waters ?? []).filter((item) => item.date === date))
  const symptoms = byTime(data.symptoms.filter((item) => item.date === date))
  const metric = data.dailyMetrics.find((item) => item.date === date)
  const notices = careNotices(data, date)
  const waterTotal = totalWaterMl(waters)
  const calorieTotal = totalCalories(meals)
  const caloriesLogged = hasCalories(meals)
  const poopSummary = poops.length === 1
    ? `Type ${poops[0].bristol}`
    : poops.length > 1
      ? `${poops.length} · ${bristolGroupMeta(bristolGroup(poops.at(-1)!.bristol)).label.split(' ')[0]}`
      : '—'

  return (
    <>
      <div className="quick-log" role="group" aria-label="Quick log">
        <button type="button" className="primary-log" onClick={onAddMeal}>
          <span className="qi" aria-hidden="true">🍽️</span>Meal
        </button>
        <button type="button" onClick={onAddWater}>
          <span className="qi" aria-hidden="true">💧</span>Water
        </button>
        <button type="button" onClick={onAddPoop}>
          <span className="qi" aria-hidden="true">🚽</span>Poop
        </button>
        <button type="button" onClick={onAddSymptom}>
          <span className="qi" aria-hidden="true">🩹</span>Symptom
        </button>
        <button type="button" onClick={onCheckIn}>
          <span className="qi" aria-hidden="true">📝</span>Check-in
        </button>
      </div>

      <CareNotices notices={notices} />

      <MealSchedule summary={daySummary} onLog={onLogSlot} onEditMeal={onEditMeal} onSkip={onSkipSlot} onClearSkip={onClearSlot} />

      <div className="summary">
        <div className="summary-card">
          <span>Meals</span>
          <strong>{meals.length || '—'}</strong>
        </div>
        <div className="summary-card">
          <span>Water</span>
          <strong>{waters.length ? formatTotalMl(waterTotal) : '—'}</strong>
        </div>
        <div className="summary-card">
          <span>Poops</span>
          <strong>{poops.length ? poopSummary : '—'}</strong>
        </div>
        <div className="summary-card">
          <span>Symptoms</span>
          <strong>{symptoms.length || '—'}</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>All meal entries</h3>
            <p>
              {caloriesLogged
                ? `${formatCalories(calorieTotal)} today`
                : 'Breakfast through dinner, plus snacks'}
            </p>
          </div>
          <button className="add-btn" onClick={onAddMeal}>+ Add</button>
        </div>
        {meals.length === 0 ? (
          <div className="empty">Nothing logged yet. Add what {name} ate today.</div>
        ) : (
          <>
            <div className="entry-list">
              {meals.map((entry) => (
                <MealCard key={entry.id} entry={entry} onSelect={() => onEditMeal(entry)} />
              ))}
            </div>
            {caloriesLogged && (
              <div className="calorie-total">
                <span>Total calorie consumption</span>
                <strong>{formatCalories(calorieTotal)}</strong>
              </div>
            )}
          </>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Water</h3>
            <p>{waters.length ? `${formatTotalMl(waterTotal)} today` : 'Sips, cups, and bottles through the day'}</p>
          </div>
          <button className="add-btn" onClick={onAddWater}>+ Add</button>
        </div>
        {waters.length === 0 ? (
          <div className="empty">No water logged yet. Add a drink when they have one.</div>
        ) : (
          <>
            <div className="entry-list">
              {waters.map((entry) => (
                <button key={entry.id} className="entry" onClick={() => onEditWater(entry)}>
                  <WaterDrop />
                  <span>
                    <div className="title">{formatWater(entry.amount, entry.unit)}</div>
                    {entry.notes && <div className="detail">{entry.notes}</div>}
                  </span>
                  <span className="meta">{formatTime(entry.time)}</span>
                </button>
              ))}
            </div>
            <div className="water-total">
              <span>Total water consumption</span>
              <strong>{formatTotalMl(waterTotal)}</strong>
            </div>
          </>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Bowel movements</h3>
            <p>Bristol type, colour, and how it felt</p>
          </div>
          <button className="add-btn" onClick={onAddPoop}>+ Add</button>
        </div>
        {poops.length === 0 ? (
          <div className="empty">No poops logged today.</div>
        ) : (
          <div className="entry-list">
            {poops.map((entry) => <PoopRow key={entry.id} entry={entry} onSelect={() => onEditPoop(entry)} />)}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Symptoms</h3>
            <p>Tummy troubles, separate from meals</p>
          </div>
          <button className="add-btn" onClick={onAddSymptom}>+ Add</button>
        </div>
        {symptoms.length === 0 ? (
          <div className="empty">No symptoms logged. Nothing to note is good news.</div>
        ) : (
          <div className="entry-list">
            {symptoms.map((entry) => <SymptomRow key={entry.id} entry={entry} onSelect={() => onEditSymptom(entry)} />)}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Daily check-in</h3>
            <p>Appetite, energy, sleep and digestion</p>
          </div>
          <button className="add-btn" onClick={onCheckIn}>{metric ? 'Edit' : '+ Add'}</button>
        </div>
        {metric ? (
          <div className="insight">
            <div className="row"><span>Appetite</span><strong>{metric.appetite ? metric.appetite[0].toUpperCase() + metric.appetite.slice(1) : '—'}</strong></div>
            <div className="row"><span>Energy</span><strong>{metric.energy ? metric.energy[0].toUpperCase() + metric.energy.slice(1) : '—'}</strong></div>
            <div className="row"><span>Sleep</span><strong>{metric.sleepHours != null ? `${metric.sleepHours} h` : '—'}</strong></div>
            {metric.digestionNotes && <div className="row"><span>Digestion</span><strong>{metric.digestionNotes}</strong></div>}
          </div>
        ) : (
          <div className="empty">How was {name}'s appetite and energy today? Takes 10 seconds.</div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Mood</h3>
            <p>How {name} seemed through the day</p>
          </div>
          <button className="add-btn" onClick={onAddMood}>+ Add</button>
        </div>
        {moods.length === 0 ? (
          <div className="empty">No mood logged yet. Tap add when you notice a shift.</div>
        ) : (
          <div className="entry-list">
            {moods.map((entry) => (
              <button key={entry.id} className="entry" onClick={() => onEditMood(entry)}>
                <MoodFace mood={entry.mood} />
                <span>
                  <div className="title">{moodMeta(entry.mood).label}</div>
                  {entry.notes && <div className="detail">{entry.notes}</div>}
                </span>
                <span className="meta">{formatTime(entry.time)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section note-box">
        <div className="section-head">
          <div>
            <h3>Day note</h3>
            <p>Anything else — sleep, fever, new foods, travel</p>
          </div>
        </div>
        <textarea
          value={data.dayNotes[date] ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={onNoteBlur}
          placeholder="Optional notes for this day..."
        />
      </section>
    </>
  )
}
