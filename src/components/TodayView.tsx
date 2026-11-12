import { bristolMeta, moodMeta, stoolColorMeta } from '../constants'
import { formatTime } from '../dates'
import { formatCalories, hasCalories, totalCalories } from '../meals'
import type { JournalData, MealEntry, MoodEntry, PoopEntry, WaterEntry } from '../types'
import { formatTotalMl, formatWater, totalWaterMl } from '../water'
import { MoodFace, StoolArt, WaterDrop } from './Icons'
import { MealCard } from './MealCard'

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
  onEditMeal,
  onEditPoop,
  onEditMood,
  onEditWater,
  onNoteChange,
  onNoteBlur,
}: {
  date: string
  name: string
  data: JournalData
  onAddMeal: () => void
  onAddPoop: () => void
  onAddMood: () => void
  onAddWater: () => void
  onEditMeal: (entry: MealEntry) => void
  onEditPoop: (entry: PoopEntry) => void
  onEditMood: (entry: MoodEntry) => void
  onEditWater: (entry: WaterEntry) => void
  onNoteChange: (note: string) => void
  onNoteBlur: () => void
}) {
  const meals = byTime(data.meals.filter((item) => item.date === date))
  const poops = byTime(data.poops.filter((item) => item.date === date))
  const moods = byTime(data.moods.filter((item) => item.date === date))
  const waters = byTime((data.waters ?? []).filter((item) => item.date === date))
  const latestMood = moods.at(-1)
  const waterTotal = totalWaterMl(waters)
  const calorieTotal = totalCalories(meals)
  const caloriesLogged = hasCalories(meals)
  const poopSummary = poops.length === 1
    ? `Type ${poops[0].bristol}`
    : poops.length > 1
      ? `${poops.length}`
      : '—'

  return (
    <>
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
          <span>Mood</span>
          <strong>{latestMood ? moodMeta(latestMood.mood).label : '—'}</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Meals & snacks</h3>
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
            <h3>Poop log</h3>
            <p>Time, Bristol type, color, and how it felt</p>
          </div>
          <button className="add-btn" onClick={onAddPoop}>+ Add</button>
        </div>
        {poops.length === 0 ? (
          <div className="empty">No poops logged today.</div>
        ) : (
          <div className="entry-list">
            {poops.map((entry) => {
              const meta = bristolMeta(entry.bristol)
              const color = stoolColorMeta(entry.color)
              return (
                <button key={entry.id} className="entry" onClick={() => onEditPoop(entry)}>
                  <StoolArt type={entry.bristol} />
                  <span>
                    <div className="title">
                      Type {entry.bristol} · {meta.title}
                    </div>
                    <div className="detail">
                      {color.label} · {entry.amount}
                      {entry.notes ? ` · ${entry.notes}` : ''}
                    </div>
                    {(entry.straining || entry.pain || entry.mucus) && (
                      <div className="flags">
                        {entry.straining && <span className="flag">Straining</span>}
                        {entry.pain && <span className="flag">Pain</span>}
                        {entry.mucus && <span className="flag">Mucus</span>}
                      </div>
                    )}
                  </span>
                  <span className="meta">{formatTime(entry.time)}</span>
                </button>
              )
            })}
          </div>
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
