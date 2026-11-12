import { useMemo, useState, type ReactNode } from 'react'
import { bristolMeta, mealLabel, moodMeta, stoolColorMeta } from '../constants'
import {
  formatLongDate,
  formatMonthYear,
  formatTime,
  isToday,
  monthCells,
  parseISODate,
  shiftMonth,
  todayISO,
  weekdayLabels,
} from '../dates'
import {
  formatCalories,
  formatConsistency,
  formatDuration,
  formatQuantity,
  hasCalories,
  mealDurationMinutes,
  totalCalories,
} from '../meals'
import { parseImportedJournal } from '../storage'
import type { JournalData, MealEntry, MoodEntry, PoopEntry, WaterEntry } from '../types'
import { formatTotalMl, formatWater, totalWaterMl } from '../water'
import { Chevron, MoodFace, StoolArt, WaterDrop } from './Icons'
import { MealPhotoStrip } from './MealPhotos'

type Filter = 'all' | 'meals' | 'poops' | 'moods' | 'water'

function datesWithEntries(data: JournalData) {
  const set = new Set<string>([
    ...data.meals.map((item) => item.date),
    ...data.poops.map((item) => item.date),
    ...data.moods.map((item) => item.date),
    ...(data.waters ?? []).map((item) => item.date),
    ...Object.keys(data.dayNotes).filter((date) => data.dayNotes[date]?.trim()),
  ])
  return set
}

export function HistoryView({
  data,
  onImport,
  onExport,
  onOpenDate,
}: {
  data: JournalData
  onImport: (text: string) => Promise<void>
  onExport: () => Promise<void>
  onOpenDate: (iso: string) => void
}) {
  const today = todayISO()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(() => {
    const date = parseISODate(today)
    return { year: date.getFullYear(), month: date.getMonth() }
  })

  const logged = useMemo(() => datesWithEntries(data), [data])
  const cells = useMemo(() => monthCells(month.year, month.month), [month])
  const weekdays = useMemo(() => weekdayLabels(), [])
  const current = parseISODate(today)
  const atCurrentMonth = month.year === current.getFullYear() && month.month === current.getMonth()

  const meals = filter === 'all' || filter === 'meals' ? data.meals.filter((item) => item.date === selected) : []
  const poops = filter === 'all' || filter === 'poops' ? data.poops.filter((item) => item.date === selected) : []
  const moods = filter === 'all' || filter === 'moods' ? data.moods.filter((item) => item.date === selected) : []
  const waters = filter === 'all' || filter === 'water' ? (data.waters ?? []).filter((item) => item.date === selected) : []
  const note = filter === 'all' ? data.dayNotes[selected] : ''
  const empty = !meals.length && !poops.length && !moods.length && !waters.length && !note?.trim()

  return (
    <>
      <div className="toolbar">
        {(['all', 'meals', 'poops', 'moods', 'water'] as const).map((item) => (
          <button
            key={item}
            className={filter === item ? 'active' : undefined}
            onClick={() => setFilter(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
        <button
          onClick={() =>
            void onExport().catch((error: unknown) => {
              window.alert(error instanceof Error ? error.message : 'Could not export the backup.')
            })
          }
        >
          Export backup
        </button>
        <label>
          Import backup
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                try {
                  parseImportedJournal(text)
                } catch {
                  window.alert('Could not read that backup file.')
                  return
                }
                if (window.confirm('Replace the journal with the imported backup?')) {
                  await onImport(text)
                }
              } catch (error) {
                window.alert(error instanceof Error ? error.message : 'Could not import that backup.')
              }
              event.target.value = ''
            }}
          />
        </label>
      </div>

      <section className="calendar">
        <div className="calendar-head">
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => setMonth((value) => shiftMonth(value.year, value.month, -1))}
          >
            <Chevron dir="left" />
          </button>
          <h2>{formatMonthYear(month.year, month.month)}</h2>
          <button
            className="icon-btn"
            aria-label="Next month"
            disabled={atCurrentMonth}
            onClick={() => setMonth((value) => shiftMonth(value.year, value.month, 1))}
          >
            <Chevron dir="right" />
          </button>
        </div>
        <div className="calendar-weekdays">
          {weekdays.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((iso, index) => {
            if (!iso) return <span className="calendar-blank" key={`blank-${index}`} />
            const future = iso > today
            const classes = [
              'calendar-day',
              selected === iso ? 'selected' : '',
              isToday(iso) ? 'today' : '',
              logged.has(iso) ? 'has-log' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={iso}
                className={classes}
                disabled={future}
                onClick={() => setSelected(iso)}
                aria-pressed={selected === iso}
                aria-label={formatLongDate(iso)}
              >
                <span>{parseISODate(iso).getDate()}</span>
                {logged.has(iso) && <i className="dot" />}
              </button>
            )
          })}
        </div>
      </section>

      <section className="history-day">
        <div className="history-day-head">
          <div>
            <h2>{formatLongDate(selected)}</h2>
            <p>{empty ? 'Nothing logged on this day' : 'What was logged this day'}</p>
          </div>
          <button className="add-btn" onClick={() => onOpenDate(selected)}>
            Modify
          </button>
        </div>
        {empty ? (
          <div className="empty">Tap a date with a dot, or modify this day to add entries.</div>
        ) : (
          <DayEntries meals={meals} poops={poops} moods={moods} waters={waters} note={note} />
        )}
      </section>
    </>
  )
}

function byTime<T extends { time: string }>(items: T[]) {
  return [...items].sort((a, b) => a.time.localeCompare(b.time))
}

function DaySection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function DayEntries({
  meals,
  poops,
  moods,
  waters,
  note,
}: {
  meals: MealEntry[]
  poops: PoopEntry[]
  moods: MoodEntry[]
  waters: WaterEntry[]
  note?: string
}) {
  const mealList = byTime(meals)
  const waterList = byTime(waters)
  const poopList = byTime(poops)
  const moodList = byTime(moods)
  const caloriesLogged = hasCalories(mealList)

  return (
    <>
      {mealList.length > 0 && (
        <DaySection
          title="Meals & snacks"
          hint={caloriesLogged ? `${formatCalories(totalCalories(mealList))} this day` : `${mealList.length} logged`}
        >
          <div className="entry-list">
            {mealList.map((entry) => {
              const duration = mealDurationMinutes(entry)
              const bits = [
                entry.quantity != null ? formatQuantity(entry.quantity, entry.quantityUnit) : '',
                formatConsistency(entry.consistency, entry.consistencyPercent),
                entry.calories != null ? formatCalories(entry.calories) : '',
                duration != null ? formatDuration(duration) : '',
                entry.notes,
              ].filter(Boolean)
              return (
                <div className="entry meal-card" key={entry.id}>
                  <div className="entry-body">
                    <span className="badge">{mealLabel(entry.type)}</span>
                    <span>
                      <div className="title">{entry.foods}</div>
                      {bits.length > 0 && <div className="detail">{bits.join(' · ')}</div>}
                    </span>
                    <span className="meta">
                      {formatTime(entry.time)}
                      {entry.endTime ? ` – ${formatTime(entry.endTime)}` : ''}
                    </span>
                  </div>
                  <MealPhotoStrip
                    mealId={entry.id}
                    before={entry.hasBeforePhoto}
                    after={entry.hasAfterPhoto}
                  />
                </div>
              )
            })}
          </div>
          {caloriesLogged && (
            <div className="calorie-total">
              <span>Total calorie consumption</span>
              <strong>{formatCalories(totalCalories(mealList))}</strong>
            </div>
          )}
        </DaySection>
      )}

      {waterList.length > 0 && (
        <DaySection title="Water" hint={`${formatTotalMl(totalWaterMl(waterList))} this day`}>
          <div className="entry-list">
            {waterList.map((entry) => (
              <div className="entry" key={entry.id}>
                <WaterDrop />
                <span>
                  <div className="title">{formatWater(entry.amount, entry.unit)}</div>
                  {entry.notes && <div className="detail">{entry.notes}</div>}
                </span>
                <span className="meta">{formatTime(entry.time)}</span>
              </div>
            ))}
          </div>
          <div className="water-total">
            <span>Total water consumption</span>
            <strong>{formatTotalMl(totalWaterMl(waterList))}</strong>
          </div>
        </DaySection>
      )}

      {poopList.length > 0 && (
        <DaySection title="Poop log" hint={`${poopList.length} logged`}>
          <div className="entry-list">
            {poopList.map((entry) => {
              const meta = bristolMeta(entry.bristol)
              const color = stoolColorMeta(entry.color)
              return (
                <div className="entry" key={entry.id}>
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
                </div>
              )
            })}
          </div>
        </DaySection>
      )}

      {moodList.length > 0 && (
        <DaySection title="Mood" hint={`${moodList.length} logged`}>
          <div className="entry-list">
            {moodList.map((entry) => (
              <div className="entry" key={entry.id}>
                <MoodFace mood={entry.mood} />
                <span>
                  <div className="title">{moodMeta(entry.mood).label}</div>
                  {entry.notes && <div className="detail">{entry.notes}</div>}
                </span>
                <span className="meta">{formatTime(entry.time)}</span>
              </div>
            ))}
          </div>
        </DaySection>
      )}

      {note?.trim() && (
        <DaySection title="Day note">
          <p className="history-note">{note}</p>
        </DaySection>
      )}
    </>
  )
}
