import { lazy, Suspense, useMemo, useState } from 'react'
import {
  formatMonthRange,
  formatLongDate,
  formatShortDate,
  formatWeekday,
  formatWeekRange,
  mondayOf,
  monthDates,
  monthStart,
  previousMonthDates,
  previousWeekDates,
  shiftDate,
  shiftDateByMonth,
  todayISO,
  weekDates,
} from '../dates'
import { formatGap } from '../gut'
import { SLOTS } from '../mealSlots'
import { buildPeriodReport } from '../meals'
import { comparisonSections, previousRange, reportHighlights, summarisePeriod, type CompareRow, type ReportRange } from '../reports'
import { DISCLAIMER } from '../safety'
import type { ChildProfile, GrowthEntry, JournalData, MealEntry, PoopEntry, SymptomEntry, WaterEntry } from '../types'
import { BarList, ColumnChart } from './Charts'
import { Chevron } from './Icons'
import { TimelineView } from './TimelineView'

// Growth (WHO tables) and the printable report load on demand to keep the main bundle small.
const GrowthView = lazy(() => import('./GrowthView').then((module) => ({ default: module.GrowthView })))
const DoctorReport = lazy(() => import('./DoctorReport').then((module) => ({ default: module.DoctorReport })))

type Tab = 'summary' | 'timeline' | 'growth'

function columnLabel(date: string, index: number, count: number) {
  if (count <= 14) return formatWeekday(date)
  return index % 5 === 0 || index === count - 1 ? String(Number(date.slice(8))) : ''
}
type Period = 'week' | 'month' | 'custom'

function CompareTable({ title, rows, currentLabel, previousLabel }: { title: string; rows: CompareRow[]; currentLabel: string; previousLabel: string }) {
  return (
    <section className="section">
      <div className="section-head"><div><h3>{title}</h3></div></div>
      <div className="chart-table-wrap compare-wrap">
        <table className="chart-table compare-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{currentLabel}</th>
              <th scope="col">{previousLabel}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{row.current}</td>
                <td>{row.previous}</td>
                <td className={`change ${row.direction}`}>
                  {row.direction === 'up' && <span aria-hidden="true">▲ </span>}
                  {row.direction === 'down' && <span aria-hidden="true">▼ </span>}
                  {row.change || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Summary({ data, date, onChangeDate }: { data: JournalData; date: string; onChangeDate: (iso: string) => void }) {
  const today = todayISO()
  const [period, setPeriod] = useState<Period>('week')
  const [customStart, setCustomStart] = useState(shiftDate(today, -13))
  const [customEnd, setCustomEnd] = useState(today)

  const { current, previous, label, previousLabel } = useMemo(() => {
    if (period === 'custom') {
      const range: ReportRange = { start: customStart <= customEnd ? customStart : customEnd, end: customEnd }
      const prev = previousRange(range)
      return {
        current: range,
        previous: prev,
        label: `${formatShortDate(range.start)} – ${formatShortDate(range.end)}`,
        previousLabel: `${formatShortDate(prev.start)} – ${formatShortDate(prev.end)}`,
      }
    }
    const days = period === 'week' ? weekDates(date) : monthDates(date)
    const prevDays = period === 'week' ? previousWeekDates(days) : previousMonthDates(days)
    return {
      current: { start: days[0], end: days[days.length - 1] },
      previous: { start: prevDays[0], end: prevDays[prevDays.length - 1] },
      label: period === 'week' ? formatWeekRange(days) : formatMonthRange(days),
      previousLabel: period === 'week' ? 'Previous week' : 'Previous month',
    }
  }, [period, date, customStart, customEnd])

  const summary = useMemo(() => summarisePeriod(data, current), [data, current])
  const before = useMemo(() => summarisePeriod(data, previous), [data, previous])
  const sections = useMemo(() => comparisonSections(summary, before), [summary, before])
  const highlights = useMemo(() => reportHighlights(summary, before), [summary, before])
  // Meal timing, calories and water observations from the original weekly/monthly report.
  const legacy = useMemo(
    () => (period === 'custom' ? null : buildPeriodReport(data, summary.days, before.days, period)),
    [data, period, summary.days, before.days],
  )
  const atCurrent = period === 'week' ? mondayOf(date) >= mondayOf(today) : monthStart(date) >= monthStart(today)
  const partial = period !== 'custom' && current.end === today && summary.days.length < (period === 'week' ? 7 : 28)
  const thisLabel = period === 'custom' ? 'This range' : period === 'week' ? 'This week' : 'This month'

  return (
    <>
      <div className="toolbar">
        {(['week', 'month', 'custom'] as const).map((item) => (
          <button key={item} className={period === item ? 'active' : undefined} onClick={() => setPeriod(item)}>
            {item === 'week' ? 'Week' : item === 'month' ? 'Month' : 'Custom'}
          </button>
        ))}
      </div>

      {period === 'custom' ? (
        <div className="filter-row">
          <label className="field">
            <span>From</span>
            <input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value || customStart)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={customEnd} max={today} onChange={(event) => setCustomEnd(event.target.value || today)} />
          </label>
        </div>
      ) : (
        <div className="date-nav">
          <button
            className="icon-btn"
            aria-label={period === 'week' ? 'Previous week' : 'Previous month'}
            onClick={() => onChangeDate(period === 'week' ? shiftDate(date, -7) : shiftDateByMonth(date, -1))}
          >
            <Chevron dir="left" />
          </button>
          <div className="date-nav-copy">
            <h2>{period === 'week' ? 'Weekly report' : 'Monthly report'}</h2>
            <div className="sub">{label}</div>
          </div>
          <button
            className="icon-btn"
            aria-label={period === 'week' ? 'Next week' : 'Next month'}
            disabled={atCurrent}
            onClick={() => onChangeDate(period === 'week' ? shiftDate(date, 7) : shiftDateByMonth(date, 1))}
          >
            <Chevron dir="right" />
          </button>
        </div>
      )}

      <div className="stat-tiles">
        <div className="stat-tile"><span>Days tracked</span><strong>{summary.trackedDays}/{summary.days.length}</strong></div>
        <div className="stat-tile"><span>Meals</span><strong>{summary.eating.meals}</strong></div>
        <div className="stat-tile"><span>Bowel movements</span><strong>{summary.gut.bowelMovements}</strong></div>
        <div className="stat-tile"><span>Symptoms</span><strong>{summary.gut.symptoms}</strong></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Highlights</h3>
            <p>{partial ? `So far, compared with the same days of the ${period === 'week' ? 'previous week' : 'previous month'}` : `Compared with ${previousLabel.toLowerCase().startsWith('previous') ? `the ${previousLabel.toLowerCase()}` : previousLabel}`}</p>
          </div>
        </div>
        <ul className="observations">{highlights.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <CompareTable title="Meal tracking" rows={sections.schedule} currentLabel={thisLabel} previousLabel={period === 'custom' ? 'Before' : 'Previous'} />
      <p className="muted-note report-note">Averages use only days with at least one meal recorded — unrecorded meals are not counted as skipped.</p>

      <section className="section">
        <ColumnChart
          title="Meals recorded per day"
          subtitle="Eaten and explicitly skipped, out of 5 scheduled meals"
          unit="meals"
          series={[
            { id: 'eaten', label: 'Eaten', color: '#2a78d6' },
            { id: 'skipped', label: 'Not eaten', color: '#eb6834' },
          ]}
          columns={summary.schedule.byDay.map((day, index) => ({
            key: day.date,
            label: columnLabel(day.date, index, summary.days.length),
            full: formatLongDate(day.date),
            values: { eaten: day.eaten, skipped: day.skipped },
            missing: day.notLogged === 5,
          }))}
        />
      </section>

      <section className="section">
        <ColumnChart
          title="Share of served food eaten"
          subtitle="Days with all 5 meals recorded and amounts known; a skipped meal counts as 0%"
          unit="%"
          series={[{ id: 'percent', label: 'Eaten', color: '#1baf7a' }]}
          columns={summary.schedule.byDay.map((day, index) => ({
            key: day.date,
            label: columnLabel(day.date, index, summary.days.length),
            full: formatLongDate(day.date),
            values: { percent: day.percent ?? 0 },
            missing: day.percent == null,
          }))}
        />
      </section>

      {SLOTS.some((slot) => summary.schedule.skippedBySlot[slot.id] > 0) && (
        <section className="section">
          <BarList
            title="Skipped meals by slot"
            subtitle="Times each meal was marked Not eaten"
            rows={SLOTS.map((slot) => ({ key: slot.id, label: slot.label, text: slot.label, value: summary.schedule.skippedBySlot[slot.id], color: '#eb6834' }))}
          />
        </section>
      )}

      <CompareTable title="Hydration" rows={sections.hydration} currentLabel={thisLabel} previousLabel={period === 'custom' ? 'Before' : 'Previous'} />
      <section className="section">
        <ColumnChart
          title="Water per day"
          subtitle="Plain water only; a dash means no water was recorded that day"
          unit="ml"
          series={[{ id: 'ml', label: 'Water', color: '#2a78d6' }]}
          columns={summary.hydration.byDay.map((day, index) => ({
            key: day.date,
            label: columnLabel(day.date, index, summary.days.length),
            full: formatLongDate(day.date),
            values: { ml: day.ml ?? 0 },
            missing: day.ml == null,
          }))}
        />
      </section>

      <CompareTable title="Eating habits" rows={sections.eating} currentLabel={thisLabel} previousLabel={period === 'custom' ? 'Before' : 'Previous'} />
      <CompareTable title="Nutrition" rows={sections.nutrition} currentLabel={thisLabel} previousLabel={period === 'custom' ? 'Before' : 'Previous'} />
      <p className="muted-note report-note">Nutrient values are estimates per day with meals logged, from foods with known amounts and composition data.</p>
      <CompareTable title="Gut health" rows={sections.gut} currentLabel={thisLabel} previousLabel={period === 'custom' ? 'Before' : 'Previous'} />
      {(summary.checkIns.days > 0 || before.checkIns.days > 0) && (
        <CompareTable title="Daily check-ins" rows={sections.wellbeing} currentLabel={thisLabel} previousLabel={period === 'custom' ? 'Before' : 'Previous'} />
      )}

      {summary.eating.mostEaten.length > 0 && (
        <section className="section">
          <BarList
            title="Most often eaten"
            subtitle="Number of meals each food appeared in"
            rows={summary.eating.mostEaten.map((item) => ({ key: item.name, label: item.name, text: item.name, value: item.count, color: '#2a78d6' }))}
          />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Food reactions</h3>
            <p>Suspected foods you marked, and repeated food → symptom sequences</p>
          </div>
        </div>
        {summary.reactions.parentLinked.length === 0 && summary.reactions.associations.length === 0 ? (
          <div className="empty">No suspected foods or repeated sequences in this period.</div>
        ) : (
          <ul className="observations">
            {summary.reactions.parentLinked.map((item) => (
              <li key={`${item.food}-${item.symptom}`}>You marked <strong>{item.food}</strong> as suspected for {item.symptom.toLowerCase()} {item.count === 1 ? 'once' : `${item.count} times`}.</li>
            ))}
            {summary.reactions.associations.map((item) => (
              <li key={`${item.key}-${item.symptomType}`}>
                {item.symptomName} followed <strong>{item.foodName}</strong> within 24 h on {item.occasions} of {item.exposures} occasions (typically {formatGap(item.medianGapMinutes)} later).
              </li>
            ))}
          </ul>
        )}
        <p className="muted-note">A sequence in time is not proof that a food caused a symptom. Discuss suspected foods with your pediatrician before removing them from the diet.</p>
      </section>

      {legacy && legacy.observations.length > 0 && (
        <section className="section">
          <div className="section-head"><div><h3>Meal timing and water</h3></div></div>
          <ul className="observations">{legacy.observations.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
    </>
  )
}

export function ReportsView({
  date,
  data,
  childName,
  onChangeDate,
  onEditMeal,
  onEditPoop,
  onEditSymptom,
  onEditWater,
  onSaveGrowth,
  onDeleteGrowth,
  onSaveProfile,
}: {
  date: string
  data: JournalData
  childName: string
  onChangeDate: (iso: string) => void
  onEditMeal: (entry: MealEntry) => void
  onEditPoop: (entry: PoopEntry) => void
  onEditSymptom: (entry: SymptomEntry) => void
  onEditWater: (entry: WaterEntry) => void
  onSaveGrowth: (entry: GrowthEntry) => Promise<void>
  onDeleteGrowth: (id: string) => Promise<void>
  onSaveProfile: (profile: ChildProfile) => Promise<void>
}) {
  const [tab, setTab] = useState<Tab>('summary')
  const [doctorOpen, setDoctorOpen] = useState(false)

  return (
    <>
      <button type="button" className="doctor-card" onClick={() => setDoctorOpen(true)}>
        <span className="qi" aria-hidden="true">🩺</span>
        <span>
          <strong>Pediatrician report</strong>
          <small>Growth, gut health, symptoms and eating in one printable summary · save as PDF</small>
        </span>
        <Chevron dir="right" />
      </button>

      <div className="segmented" role="tablist" aria-label="Report sections">
        {([
          ['summary', 'Summary'],
          ['timeline', 'Food & gut timeline'],
          ['growth', 'Growth'],
        ] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <Summary data={data} date={date} onChangeDate={onChangeDate} />}
      {tab === 'timeline' && <TimelineView data={data} onEditMeal={onEditMeal} onEditPoop={onEditPoop} onEditSymptom={onEditSymptom} onEditWater={onEditWater} />}
      {tab === 'growth' && (
        <Suspense fallback={<div className="empty">Loading growth charts…</div>}>
          <GrowthView data={data} onSave={onSaveGrowth} onDelete={onDeleteGrowth} onSaveProfile={onSaveProfile} />
        </Suspense>
      )}
      <p className="disclaimer">{DISCLAIMER}</p>

      {doctorOpen && (
        <Suspense fallback={null}>
          <DoctorReport data={data} childName={childName} onClose={() => setDoctorOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
