import { useMemo, useState } from 'react'
import { formatLongDate, formatShortDate, formatWeekday, isToday, shiftDate, todayISO } from '../dates'
import { FOOD_GROUPS } from '../foods'
import {
  averageTotals,
  distinctFoods,
  formatAge,
  formatNutrient,
  groupCoverage,
  NUTRIENT_ORDER,
  NUTRIENTS,
  nutritionInsights,
  referenceValues,
  summarise,
  weekGroupGrid,
  type NutrientTotals,
  type NutritionSummary,
} from '../nutrition'
import type { ChildProfile, JournalData, NutrientKey, Settings } from '../types'
import { ColumnChart, PresenceGrid } from './Charts'
import { Chevron } from './Icons'
import { Modal } from './Modal'

type Mode = 'day' | 'week'

function NutrientTable({
  totals,
  references,
  label,
}: {
  totals: NutrientTotals
  references: Record<NutrientKey, number | null>
  label: string
}) {
  return (
    <div className="nutrient-table">
      {NUTRIENT_ORDER.map((key) => {
        const total = totals[key]
        const reference = references[key]
        const percent = reference ? Math.round((total.value / reference) * 100) : null
        const nothing = total.value === 0 && total.unknown > 0
        return (
          <div key={key} className="nutrient-row">
            <span className="nutrient-name">{NUTRIENTS[key].label}</span>
            <span className="nutrient-value">
              {nothing ? 'no data' : `${total.unknown > 0 ? '≥ ' : '≈ '}${formatNutrient(key, total.value)}`}
            </span>
            <span className="nutrient-bar" aria-hidden="true">
              {percent != null && !nothing && <i style={{ width: `${Math.min(100, percent)}%` }} />}
            </span>
            <span className="nutrient-ref">
              {percent != null && !nothing ? `${percent}% of ${formatNutrient(key, reference!)}` : reference ? `ref. ${formatNutrient(key, reference)}` : 'no single reference'}
            </span>
          </div>
        )
      })}
      <p className="muted-note" style={{ margin: '8px 0 0' }}>
        {label} “≥” means some foods had no data for that nutrient, so the real amount is higher than shown.
      </p>
    </div>
  )
}

function DataQuality({ summary }: { summary: NutritionSummary }) {
  const missing = summary.items.filter((item) => item.status === 'missing')
  return (
    <div className="data-quality">
      <span className="tag estimate">{summary.counted} food{summary.counted === 1 ? '' : 's'} estimated</span>
      {summary.items.some((item) => item.status === 'label') && <span className="tag label">includes label values</span>}
      {missing.length > 0 && <span className="tag missing">{missing.length} without data</span>}
      {summary.refused > 0 && <span className="tag">{summary.refused} refused (counted as 0)</span>}
      {summary.untracked > 0 && <span className="tag missing">{summary.untracked} meal{summary.untracked === 1 ? '' : 's'} typed as text only</span>}
      {missing.length > 0 && (
        <ul className="missing-list">
          {missing.map((item, index) => (
            <li key={`${item.mealId}-${index}`}>{item.name}: {item.reason.toLowerCase()}</li>
          ))}
        </ul>
      )}
      {summary.enteredCalories != null && (
        <p className="muted-note" style={{ margin: 0 }}>
          Calories you entered on meals: <strong>{Math.round(summary.enteredCalories)} kcal</strong> (your own values, shown separately from the estimates).
        </p>
      )}
    </div>
  )
}

function ProfileForm({
  settings,
  onSaveProfile,
  onSaveReferences,
  onClose,
}: {
  settings: Settings
  onSaveProfile: (profile: ChildProfile) => Promise<void>
  onSaveReferences: (refs: Settings['nutrientReferences']) => Promise<void>
  onClose: () => void
}) {
  const [sex, setSex] = useState(settings.childProfile.sex)
  const [birthDate, setBirthDate] = useState(settings.childProfile.birthDate)
  const [custom, setCustom] = useState<Record<NutrientKey, string>>(
    () => Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, settings.nutrientReferences.custom[key] != null ? String(settings.nutrientReferences.custom[key]) : ''])) as Record<NutrientKey, string>,
  )
  const [error, setError] = useState<string | null>(null)
  const preview = referenceValues({ childProfile: { sex, birthDate }, nutrientReferences: { custom: {} } }, todayISO())

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault()
        const parsed: Partial<Record<NutrientKey, number>> = {}
        for (const key of NUTRIENT_ORDER) {
          if (!custom[key].trim()) continue
          const value = Number(custom[key])
          if (!Number.isFinite(value) || value <= 0) {
            setError(`${NUTRIENTS[key].label} must be a positive number`)
            return
          }
          parsed[key] = value
        }
        try {
          await onSaveProfile({ sex, birthDate })
          await onSaveReferences({ custom: parsed })
          onClose()
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Could not save')
        }
      }}
    >
      <p className="muted-note" style={{ margin: 0 }}>Used for age-based reference values and growth percentiles. Stored only in this journal.</p>
      <div className="time-pair">
        <label className="field">
          <span>Date of birth</span>
          <input type="date" value={birthDate} max={todayISO()} onChange={(event) => setBirthDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Sex (for growth charts)</span>
          <select value={sex} onChange={(event) => setSex(event.target.value as ChildProfile['sex'])}>
            <option value="">Not set</option>
            <option value="female">Girl</option>
            <option value="male">Boy</option>
          </select>
        </label>
      </div>
      <div>
        <span className="field-label">Daily reference values</span>
        <p className="muted-note" style={{ margin: '0 0 8px' }}>
          {preview.note} Leave a box empty to use the default. Change these only on your pediatrician’s or dietitian’s advice.
        </p>
        <div className="label-grid">
          {NUTRIENT_ORDER.map((key) => (
            <label key={key} className="field">
              <span>{NUTRIENTS[key].label} ({NUTRIENTS[key].unit})</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={custom[key]}
                placeholder={preview.values[key] == null ? 'none' : String(preview.values[key])}
                onChange={(event) => setCustom({ ...custom, [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="actions">
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary">Save</button>
      </div>
    </form>
  )
}

export function NutritionView({
  data,
  date,
  onChangeDate,
  onSaveProfile,
  onSaveReferences,
}: {
  data: JournalData
  date: string
  onChangeDate: (iso: string) => void
  onSaveProfile: (profile: ChildProfile) => Promise<void>
  onSaveReferences: (refs: Settings['nutrientReferences']) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>('day')
  const [trend, setTrend] = useState<NutrientKey>('proteinG')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const today = todayISO()
  const refs = useMemo(() => referenceValues(data.settings, date), [data.settings, date])
  const dayMeals = useMemo(() => data.meals.filter((meal) => meal.date === date), [data.meals, date])
  const daySummary = useMemo(() => summarise(dayMeals, data.foods), [dayMeals, data.foods])
  const dayGroups = useMemo(() => groupCoverage(dayMeals, data.foods), [dayMeals, data.foods])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDate(date, index - 6)), [date])
  const week = useMemo(() => averageTotals(data, weekDays), [data, weekDays])
  const grid = useMemo(() => weekGroupGrid(data, weekDays), [data, weekDays])
  const insights = useMemo(() => nutritionInsights(data, date), [data, date])
  const weekFoods = useMemo(() => distinctFoods(data.meals.filter((meal) => weekDays.includes(meal.date))), [data.meals, weekDays])
  const step = mode === 'day' ? 1 : 7

  return (
    <>
      <div className="toolbar">
        <button className={mode === 'day' ? 'active' : undefined} onClick={() => setMode('day')}>Day</button>
        <button className={mode === 'week' ? 'active' : undefined} onClick={() => setMode('week')}>Last 7 days</button>
        <button onClick={() => setSettingsOpen(true)}>Child profile & references</button>
      </div>

      <div className="date-nav">
        <button className="icon-btn" aria-label="Earlier" onClick={() => onChangeDate(shiftDate(date, -step))}><Chevron dir="left" /></button>
        <div className="date-nav-copy">
          <h2>{mode === 'day' ? (isToday(date) ? 'Today' : formatLongDate(date)) : 'Last 7 days'}</h2>
          <div className="sub">
            {mode === 'day' ? 'Nutrition at a glance' : `${formatShortDate(weekDays[0])} – ${formatShortDate(weekDays[6])}`}
            {refs.months != null && ` · age ${formatAge(refs.months)}`}
          </div>
        </div>
        <button className="icon-btn" aria-label="Later" disabled={date >= today} onClick={() => onChangeDate(shiftDate(date, step) > today ? today : shiftDate(date, step))}><Chevron dir="right" /></button>
      </div>

      {mode === 'day' ? (
        dayMeals.length === 0 ? (
          <section className="section"><div className="empty">No meals logged on this day yet. Log a meal from the diary to see food groups and nutrient estimates.</div></section>
        ) : (
          <>
            <section className="section">
              <div className="section-head">
                <div>
                  <h3>Food groups</h3>
                  <p>Which groups appeared today — not a measure of whether amounts were enough</p>
                </div>
              </div>
              <div className="group-tiles">
                {FOOD_GROUPS.map((group) => {
                  const coverage = dayGroups[group.id]
                  const on = coverage.servings > 0
                  return (
                    <div key={group.id} className={`group-tile ${on ? 'on' : ''}`} style={on ? { borderColor: group.color } : undefined}>
                      <span className="group-dot" style={{ background: on ? group.color : 'transparent', borderColor: group.color }} aria-hidden="true">{on ? '✓' : ''}</span>
                      <strong>{group.label}</strong>
                      <small>{on ? `${coverage.servings}× · ${coverage.foods.slice(0, 3).join(', ')}` : 'Not recorded'}</small>
                    </div>
                  )
                })}
              </div>
              <p className="muted-note" style={{ margin: '10px 0 0' }}>
                {distinctFoods(dayMeals).length} different foods recorded today.
              </p>
            </section>

            <section className="section">
              <div className="section-head">
                <div>
                  <h3>Nutrient estimates <span className="tag estimate">Estimate</span></h3>
                  <p>From recorded foods and amounts eaten, compared with daily reference values</p>
                </div>
              </div>
              <DataQuality summary={daySummary} />
              <NutrientTable totals={daySummary.totals} references={refs.values} label="One day is only a snapshot — look at the 7-day view for patterns." />
            </section>
          </>
        )
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <div>
                <h3>Observations</h3>
                <p>Patterns across the week, not judgements of single days</p>
              </div>
            </div>
            <ul className="observations">
              {insights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="section">
            <PresenceGrid
              title="Food groups by day"
              subtitle={`${grid.logged.size} of 7 days have meals logged`}
              days={weekDays.map((day) => ({ key: day, label: formatWeekday(day), full: formatLongDate(day), logged: grid.logged.has(day) }))}
              rows={FOOD_GROUPS.map((group) => ({ key: group.id, label: group.label, color: group.color, present: grid.byGroup[group.id] }))}
            />
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h3>Average per day <span className="tag estimate">Estimate</span></h3>
                <p>Averaged over the {week.loggedDays} day{week.loggedDays === 1 ? '' : 's'} with meals logged</p>
              </div>
            </div>
            {week.loggedDays === 0 ? (
              <div className="empty">No meals logged in these 7 days.</div>
            ) : (
              <NutrientTable totals={week.average} references={refs.values} label={refs.note} />
            )}
          </section>

          <section className="section">
            <label className="field" style={{ maxWidth: 260 }}>
              <span>Nutrient trend</span>
              <select value={trend} onChange={(event) => setTrend(event.target.value as NutrientKey)}>
                {NUTRIENT_ORDER.map((key) => <option key={key} value={key}>{NUTRIENTS[key].label}</option>)}
              </select>
            </label>
            <ColumnChart
              title={`${NUTRIENTS[trend].label} per day (estimate)`}
              subtitle="Days without meals logged show no bar"
              unit={NUTRIENTS[trend].unit}
              series={[{ id: 'value', label: NUTRIENTS[trend].label, color: '#7b5cb0' }]}
              reference={refs.values[trend] ? { value: refs.values[trend]!, label: `Reference ${formatNutrient(trend, refs.values[trend]!)}` } : undefined}
              columns={weekDays.map((day) => {
                const found = week.perDay.find((item) => item.day === day)
                return { key: day, label: formatWeekday(day), full: formatLongDate(day), values: { value: found ? found.summary.totals[trend].value : 0 } }
              })}
            />
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <h3>Food variety</h3>
                <p>{weekFoods.length} different foods in the last 7 days</p>
              </div>
            </div>
            <div className="food-chips">
              {weekFoods.map((name) => <span key={name} className="food-chip static">{name}</span>)}
            </div>
          </section>
        </>
      )}

      <p className="disclaimer">
        Nutrient values are estimates from food composition tables (IFCT 2017 and USDA) and the amounts you recorded; home recipes and portions vary.
        Foods without amounts or nutrient data are left out rather than guessed. Please talk to your pediatrician before changing your child’s diet or starting supplements.
      </p>

      {settingsOpen && (
        <Modal title="Child profile & reference values" onClose={() => setSettingsOpen(false)}>
          <ProfileForm settings={data.settings} onSaveProfile={onSaveProfile} onSaveReferences={onSaveReferences} onClose={() => setSettingsOpen(false)} />
        </Modal>
      )}
    </>
  )
}
