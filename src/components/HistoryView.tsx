import { useMemo, useState, type ReactNode } from 'react'
import { moodMeta, poopConsistencyMeta, stoolColorMeta } from '../constants'
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
import { foodMap } from '../foods'
import { formatCalories, hasCalories, totalCalories } from '../meals'
import { buildDayIndex, summariseDay } from '../mealSlots'
import { dayCalories, NUTRIENTS } from '../nutrition'
import { assessmentConfig, CALENDAR_LEGEND_ORDER, CALENDAR_META, calendarState, type AssessmentConfig } from '../nutritionAssessment'
import { parseImportedJournal } from '../storage'
import type { FoodEntry, JournalData, NutrientKey, NutritionAssessmentSettings, Settings, MealEntry, MoodEntry, PoopEntry, WaterEntry } from '../types'
import { formatTotalMl, formatWater, totalWaterMl } from '../water'
import { Chevron, MoodFace, StoolArt, WaterDrop } from './Icons'
import { MealCard } from './MealCard'

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

const KEY_CHOICES: NutrientKey[] = ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'fibreG', 'ironMg', 'calciumMg', 'zincMg', 'vitaminCMg', 'vitaminDUg', 'omega3G']

function AssessmentForm({ value, onSave, onClose }: { value: AssessmentConfig; onSave: (value: NutritionAssessmentSettings) => Promise<void>; onClose: () => void }) {
  const [low, setLow] = useState(String(value.lowPercent))
  const [high, setHigh] = useState(String(value.energyHighPercent))
  const [coverage, setCoverage] = useState(String(value.minCoveragePercent))
  const [share, setShare] = useState(String(value.belowSharePercent))
  const [keys, setKeys] = useState<NutrientKey[]>(value.keyNutrients)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="threshold-form"
      onSubmit={async (event) => {
        event.preventDefault()
        const numbers = [low, high, coverage, share].map(Number)
        if (numbers.some((n) => !Number.isFinite(n))) return setError('Enter numbers in every box')
        try {
          await onSave({ lowPercent: numbers[0], energyHighPercent: numbers[1], minCoveragePercent: numbers[2], belowSharePercent: numbers[3], keyNutrients: keys })
          onClose()
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save')
        }
      }}
    >
      <label className="field"><span>“Below” under (% of reference)</span><input type="number" min="10" max="100" value={low} onChange={(event) => setLow(event.target.value)} /></label>
      <label className="field"><span>Energy “above” over (%)</span><input type="number" min="100" max="300" value={high} onChange={(event) => setHigh(event.target.value)} /></label>
      <label className="field"><span>Foods needing data (%)</span><input type="number" min="0" max="100" value={coverage} onChange={(event) => setCoverage(event.target.value)} /></label>
      <label className="field"><span>Day “below” if this % of key nutrients are below</span><input type="number" min="1" max="100" value={share} onChange={(event) => setShare(event.target.value)} /></label>
      <fieldset className="key-nutrients">
        <legend>Key nutrients for the day’s colour (energy and protein always count)</legend>
        {KEY_CHOICES.map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={keys.includes(key) || key === 'energyKcal' || key === 'proteinG'}
              disabled={key === 'energyKcal' || key === 'proteinG'}
              onChange={(event) => setKeys(event.target.checked ? [...keys, key] : keys.filter((item) => item !== key))}
            />
            {NUTRIENTS[key].label}
          </label>
        ))}
      </fieldset>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="threshold-actions">
        <button type="button" className="slot-btn" onClick={async () => { await onSave({}); onClose() }}>Reset to defaults</button>
        <button type="button" className="slot-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="slot-btn primary-soft">Save</button>
      </div>
    </form>
  )
}

function CalendarLegend({ config, onSaveAssessment }: { config: AssessmentConfig; onSaveAssessment: (value: NutritionAssessmentSettings) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  // Hidden by default to keep the calendar uncluttered; one tap shows what the colours mean.
  if (!open) {
    return (
      <button type="button" className="link-btn cal-legend-toggle" aria-expanded="false" onClick={() => setOpen(true)}>
        Show colour key
      </button>
    )
  }
  return (
    <div className="cal-legend" aria-label="Calendar legend">
      <button type="button" className="link-btn cal-legend-toggle" aria-expanded="true" onClick={() => { setOpen(false); setEditing(false) }}>
        Hide colour key
      </button>
      <ul>
        {CALENDAR_LEGEND_ORDER.map((state) => (
          <li key={state}>
            <i className={`cal-swatch ${state}`} style={{ background: CALENDAR_META[state].color }} aria-hidden="true" />
            {CALENDAR_META[state].legend}
          </li>
        ))}
        <li><span className="cal-legend-ml">815 kcal</span> Calories eaten (estimate; ≥ = some foods not estimated)</li>
        <li><span className="cal-legend-ml">450 ml</span> Water that day (— = none recorded)</li>
        <li><i className="cal-bm-dot" aria-hidden="true" /> Bowel movement recorded</li>
      </ul>
      <p>
        Colour = estimated nutrient intake vs age-specific references (ICMR-NIN 2020), judged nutrient by nutrient — energy,
        protein, fibre, iron, calcium, zinc and vitamin C by default. Above the range or an upper limit is not “healthier”.{' '}
        <button type="button" className="link-btn" onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Adjust assessment'}</button>
      </p>
      {editing && <AssessmentForm value={config} onSave={onSaveAssessment} onClose={() => setEditing(false)} />}
    </div>
  )
}

export function HistoryView({
  data,
  onImport,
  onExport,
  onOpenDate,
  onOpenDay,
  onSaveAssessment,
}: {
  data: JournalData
  onImport: (text: string) => Promise<void>
  onExport: () => Promise<void>
  onOpenDate: (iso: string) => void
  /** Open the day-detail sheet for a date. */
  onOpenDay: (iso: string) => void
  onSaveAssessment: (value: NutritionAssessmentSettings) => Promise<void>
}) {
  const today = todayISO()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(() => {
    const date = parseISODate(today)
    return { year: date.getFullYear(), month: date.getMonth() }
  })

  const logged = useMemo(() => datesWithEntries(data), [data])
  // One pass over the journal per data change; each cell then reads its own date from the index.
  const dayIndex = useMemo(() => buildDayIndex(data), [data])
  const foods = useMemo(() => foodMap(data.foods), [data.foods])
  const config = assessmentConfig(data.settings)
  // Days before the first record are "before tracking", not "not logged".
  const firstLogged = useMemo(() => [...logged].sort()[0] ?? today, [logged, today])
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

      <section className="calendar history-calendar">
        <CalendarLegend config={config} onSaveAssessment={onSaveAssessment} />
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
            const tracked = !future && iso >= firstLogged
            const day = summariseDay(dayIndex, iso, foods)
            const { state } = calendarState(day.completion.status === 'complete', day.records.meals, data.foods, data.settings, iso)
            const meta = CALENDAR_META[state]
            const water = day.waterMl == null ? null : formatTotalMl(day.waterMl).replace(' ', '\u00a0')
            const calories = future ? null : dayCalories(day.records.meals, data.foods, day.completion.skipped === 5)
            const classes = [
              'hist-cell',
              tracked ? state : 'untracked',
              selected === iso ? 'selected' : '',
              isToday(iso) ? 'today' : '',
            ].filter(Boolean).join(' ')
            const label = [
              formatLongDate(iso),
              tracked ? `nutrition: ${meta.label}` : future ? 'future' : 'before tracking started',
              `meals ${day.completion.eaten} eaten, ${day.completion.skipped} skipped, ${day.completion.notLogged} not logged`,
              calories == null
                ? 'no meals recorded'
                : calories.unknown
                  ? 'calories not estimated'
                  : `${calories.partial ? 'at least ' : ''}${Math.round(calories.kcal)} kcal eaten (estimate)`,
              day.waterMl == null ? 'no water recorded' : `water ${formatTotalMl(day.waterMl)}`,
              day.bowelMovements ? `${day.bowelMovements} bowel movement${day.bowelMovements === 1 ? '' : 's'}` : 'no bowel movement recorded',
            ].join(', ')
            return (
              <button
                key={iso}
                className={classes}
                style={tracked ? { background: meta.color } : undefined}
                disabled={future}
                onClick={() => {
                  setSelected(iso)
                  onOpenDay(iso)
                }}
                aria-pressed={selected === iso}
                aria-label={label}
                title={label}
              >
                <span className="hist-num">{parseISODate(iso).getDate()}</span>
                <span className="hist-kcal">
                  {calories == null ? '' : calories.unknown ? '? kcal' : (
                    <>
                      {calories.partial ? '≥' : ''}
                      {Math.round(calories.kcal)}
                      <small>kcal</small>
                    </>
                  )}
                </span>
                <span className="hist-ml">{future ? '' : water ?? '–'}</span>
                <span className="hist-bm">{day.bowelMovements > 0 && <i className="cal-bm-dot" />}</span>
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
          <DayEntries meals={meals} poops={poops} moods={moods} waters={waters} note={note} nutrients={{ foods: data.foods, settings: data.settings }} />
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
  nutrients,
}: {
  meals: MealEntry[]
  poops: PoopEntry[]
  moods: MoodEntry[]
  waters: WaterEntry[]
  note?: string
  nutrients: { foods: FoodEntry[]; settings: Settings }
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
            {mealList.map((entry) => (
              <MealCard key={entry.id} entry={entry} nutrients={nutrients} />
            ))}
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
              const meta = poopConsistencyMeta(entry.bristol)
              const color = stoolColorMeta(entry.color)
              return (
                <div className="entry" key={entry.id}>
                  <StoolArt type={meta.bristol} />
                  <span>
                    <div className="title">
                      {meta.label}
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
