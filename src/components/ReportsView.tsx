import { useMemo, useState } from 'react'
import { bristolMeta, moodMeta } from '../constants'
import {
  calendarWeek,
  formatLongDate,
  formatMonthRange,
  formatWeekRange,
  mondayOf,
  monthCellsMonday,
  monthDates,
  monthEnd,
  monthStart,
  parseISODate,
  shiftDate,
  shiftDateByMonth,
  todayISO,
  weekDates,
  weekdayLabels,
} from '../dates'
import {
  buildMonthlyReport,
  buildWeeklyReport,
  formatCalories,
  formatDuration,
  type ReportPeriod,
} from '../meals'
import type { JournalData } from '../types'
import { formatTotalMl, weekWater } from '../water'
import { Chevron } from './Icons'

function TrendMark({ trend }: { trend: 'up' | 'down' | 'same' | 'unknown' }) {
  if (trend === 'up') return <span className="trend up">Increased</span>
  if (trend === 'down') return <span className="trend down">Decreased</span>
  if (trend === 'same') return <span className="trend same">Steady</span>
  return <span className="trend">Needs more logs</span>
}

export function ReportsView({
  date,
  data,
  onSelectDate,
  onChangeDate,
}: {
  date: string
  data: JournalData
  onSelectDate: (iso: string) => void
  onChangeDate: (iso: string) => void
}) {
  const today = todayISO()
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const days = period === 'week' ? weekDates(date) : monthDates(date)
  const report = period === 'week' ? buildWeeklyReport(data, date) : buildMonthlyReport(data, date)
  const strip = calendarWeek(date)
  const month = parseISODate(date)
  const cells = useMemo(
    () => monthCellsMonday(month.getFullYear(), month.getMonth()),
    [month],
  )
  const weekdays = useMemo(() => weekdayLabels(), [])
  const atCurrentWeek = mondayOf(date) >= mondayOf(today)
  const atCurrentMonth = monthStart(date) >= monthStart(today)
  const incomplete =
    period === 'week' ? days.length < 7 : days[days.length - 1] !== monthEnd(date)

  const periodPoops = data.poops.filter((item) => days.includes(item.date))
  const periodMoods = data.moods.filter((item) => days.includes(item.date))
  const water = weekWater(data, days)
  const bristolCounts = periodPoops.reduce<Record<number, number>>((acc, item) => {
    acc[item.bristol] = (acc[item.bristol] ?? 0) + 1
    return acc
  }, {})
  const commonBristol = Object.entries(bristolCounts).sort((a, b) => b[1] - a[1])[0]
  const moodCounts = periodMoods.reduce<Record<string, number>>((acc, item) => {
    acc[item.mood] = (acc[item.mood] ?? 0) + 1
    return acc
  }, {})
  const commonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]
  const daysWithPoop = new Set(periodPoops.map((item) => item.date)).size
  const thisLabel = period === 'week' ? 'this week' : 'this month'
  const lastLabel = period === 'week' ? 'last week' : 'last month'
  const rangeLabel = period === 'week' ? formatWeekRange(days) : formatMonthRange(days)

  return (
    <>
      <div className="toolbar">
        <button className={period === 'week' ? 'active' : undefined} onClick={() => setPeriod('week')}>
          Week
        </button>
        <button className={period === 'month' ? 'active' : undefined} onClick={() => setPeriod('month')}>
          Month
        </button>
      </div>

      <div className="date-nav">
        <button
          className="icon-btn"
          aria-label={period === 'week' ? 'Previous week' : 'Previous month'}
          onClick={() =>
            onChangeDate(period === 'week' ? shiftDate(date, -7) : shiftDateByMonth(date, -1))
          }
        >
          <Chevron dir="left" />
        </button>
        <div className="date-nav-copy">
          <h2>{period === 'week' ? 'Weekly report' : 'Monthly report'}</h2>
          <div className="sub">{rangeLabel}</div>
        </div>
        <button
          className="icon-btn"
          aria-label={period === 'week' ? 'Next week' : 'Next month'}
          disabled={period === 'week' ? atCurrentWeek : atCurrentMonth}
          onClick={() =>
            onChangeDate(period === 'week' ? shiftDate(date, 7) : shiftDateByMonth(date, 1))
          }
        >
          <Chevron dir="right" />
        </button>
      </div>

      {period === 'week' && (
        <div className="week-grid">
          {strip.map((iso) => {
            const poops = data.poops.filter((item) => item.date === iso)
            const moods = data.moods.filter((item) => item.date === iso)
            const meals = data.meals.filter((item) => item.date === iso)
            const waters = (data.waters ?? []).filter((item) => item.date === iso)
            const day = new Date(`${iso}T12:00:00`)
            const future = iso > today
            return (
              <button
                key={iso}
                className={`day-card ${iso === date ? 'selected' : ''}`}
                disabled={future}
                onClick={() => onSelectDate(iso)}
              >
                <div className="wd">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div className="dn">{day.getDate()}</div>
                <div className="dots">
                  {meals.length > 0 && <i className="dot" style={{ background: 'var(--sage-mid)' }} />}
                  {waters.length > 0 && <i className="dot" style={{ background: 'var(--sky)' }} />}
                  {poops.length > 0 && <i className="dot" style={{ background: '#8b5a2b' }} />}
                  {moods.length > 0 && <i className="dot" style={{ background: 'var(--terracotta)' }} />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {period === 'month' && (
        <section className="calendar">
          <div className="calendar-weekdays">
            {weekdays.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((iso, index) => {
              if (!iso) return <span className="calendar-blank" key={`blank-${index}`} />
              const future = iso > today
              const logged =
                data.meals.some((item) => item.date === iso) ||
                data.poops.some((item) => item.date === iso) ||
                data.moods.some((item) => item.date === iso) ||
                (data.waters ?? []).some((item) => item.date === iso)
              const classes = [
                'calendar-day',
                date === iso ? 'selected' : '',
                iso === today ? 'today' : '',
                logged ? 'has-log' : '',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={iso}
                  className={classes}
                  disabled={future}
                  onClick={() => onSelectDate(iso)}
                  aria-label={formatLongDate(iso)}
                >
                  <span>{parseISODate(iso).getDate()}</span>
                  {logged && <i className="dot" />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <h3>{period === 'week' ? 'Weekly trends' : 'Monthly trends'}</h3>
            <p>
              {incomplete
                ? `Compared with the same days ${lastLabel}`
                : `Compared with ${lastLabel}`}
            </p>
          </div>
        </div>
        <div className="report-cards">
          <article className="report-card">
            <span>Quantity intake</span>
            <TrendMark trend={report.quantity.trend} />
            <p>{report.quantity.label}</p>
          </article>
          <article className="report-card">
            <span>Calories</span>
            <TrendMark trend={report.calories.trend} />
            <p>{report.calories.label}</p>
          </article>
          <article className="report-card">
            <span>Meal time</span>
            <TrendMark trend={report.mealTime.trend} />
            <p>{report.mealTime.label}</p>
          </article>
          <article className="report-card">
            <span>Water intake</span>
            <TrendMark trend={report.water.trend} />
            <p>{report.water.label}</p>
          </article>
        </div>
        <div className="insight">
          <div className="row">
            <span>Average meal length</span>
            <strong>
              {report.thisPeriod.avgDuration != null
                ? formatDuration(Math.round(report.thisPeriod.avgDuration))
                : '—'}
            </strong>
          </div>
          <div className="row">
            <span>Meals with quantity logged</span>
            <strong>
              {report.thisPeriod.mealsWithQuantity}/{report.thisPeriod.totalMeals || 0}
            </strong>
          </div>
          <div className="row">
            <span>Calories logged</span>
            <strong>
              {report.thisPeriod.mealsWithCalories
                ? formatCalories(report.thisPeriod.calorieTotal)
                : '—'}
            </strong>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Observations</h3>
            <p>Patterns from meals, water, poops, and mood {thisLabel}</p>
          </div>
        </div>
        <ul className="observations">
          {report.observations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>{period === 'week' ? 'This week' : 'This month'}</h3>
            <p>Poop, mood, and water at a glance</p>
          </div>
        </div>
        <div className="insight">
          <div className="row">
            <span>Poops logged</span>
            <strong>{periodPoops.length} across {daysWithPoop} day{daysWithPoop === 1 ? '' : 's'}</strong>
          </div>
          <div className="row">
            <span>Most common stool</span>
            <strong>
              {commonBristol
                ? `Type ${commonBristol[0]} · ${bristolMeta(Number(commonBristol[0]) as 1 | 2 | 3 | 4 | 5 | 6 | 7).title}`
                : '—'}
            </strong>
          </div>
          <div className="row">
            <span>Most common mood</span>
            <strong>
              {commonMood ? moodMeta(commonMood[0] as Parameters<typeof moodMeta>[0]).label : '—'}
            </strong>
          </div>
          <div className="row">
            <span>Water logged</span>
            <strong>
              {water.count
                ? `${formatTotalMl(water.totalMl)} across ${water.daysWithWater} day${water.daysWithWater === 1 ? '' : 's'}`
                : '—'}
            </strong>
          </div>
        </div>
      </section>
    </>
  )
}
