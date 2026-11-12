import { bristolMeta, moodMeta } from '../constants'
import { formatLongDate, weekDates } from '../dates'
import { buildWeeklyReport, formatDuration } from '../meals'
import type { JournalData } from '../types'

function TrendMark({ trend }: { trend: 'up' | 'down' | 'same' | 'unknown' }) {
  if (trend === 'up') return <span className="trend up">Increased</span>
  if (trend === 'down') return <span className="trend down">Decreased</span>
  if (trend === 'same') return <span className="trend same">Steady</span>
  return <span className="trend">Needs more logs</span>
}

export function WeekView({
  date,
  data,
  onSelectDate,
}: {
  date: string
  data: JournalData
  onSelectDate: (iso: string) => void
}) {
  const days = weekDates(date)
  const report = buildWeeklyReport(data, date)
  const weekPoops = data.poops.filter((item) => days.includes(item.date))
  const weekMoods = data.moods.filter((item) => days.includes(item.date))

  const bristolCounts = weekPoops.reduce<Record<number, number>>((acc, item) => {
    acc[item.bristol] = (acc[item.bristol] ?? 0) + 1
    return acc
  }, {})
  const commonBristol = Object.entries(bristolCounts).sort((a, b) => b[1] - a[1])[0]
  const moodCounts = weekMoods.reduce<Record<string, number>>((acc, item) => {
    acc[item.mood] = (acc[item.mood] ?? 0) + 1
    return acc
  }, {})
  const commonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]
  const daysWithPoop = new Set(weekPoops.map((item) => item.date)).size

  return (
    <>
      <div className="week-grid">
        {days.map((iso) => {
          const poops = data.poops.filter((item) => item.date === iso)
          const moods = data.moods.filter((item) => item.date === iso)
          const meals = data.meals.filter((item) => item.date === iso)
          const day = new Date(`${iso}T12:00:00`)
          return (
            <button
              key={iso}
              className={`day-card ${iso === date ? 'selected' : ''}`}
              onClick={() => onSelectDate(iso)}
            >
              <div className="wd">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div className="dn">{day.getDate()}</div>
              <div className="dots">
                {meals.length > 0 && <i className="dot" style={{ background: '#5c7a68' }} />}
                {poops.length > 0 && <i className="dot" style={{ background: '#8b5a2b' }} />}
                {moods.length > 0 && <i className="dot" style={{ background: '#c45b38' }} />}
              </div>
            </button>
          )
        })}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Weekly report</h3>
            <p>Compared with the previous 7 days, ending {formatLongDate(date)}</p>
          </div>
        </div>
        <div className="report-cards">
          <article className="report-card">
            <span>Quantity intake</span>
            <TrendMark trend={report.quantity.trend} />
            <p>{report.quantity.label}</p>
          </article>
          <article className="report-card">
            <span>Meal time</span>
            <TrendMark trend={report.mealTime.trend} />
            <p>{report.mealTime.label}</p>
          </article>
        </div>
        <div className="insight">
          <div className="row">
            <span>Average meal length</span>
            <strong>
              {report.thisWeek.avgDuration != null
                ? formatDuration(Math.round(report.thisWeek.avgDuration))
                : '—'}
            </strong>
          </div>
          <div className="row">
            <span>Meals with quantity logged</span>
            <strong>
              {report.thisWeek.mealsWithQuantity}/{report.thisWeek.totalMeals || 0}
            </strong>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Other observations</h3>
            <p>Patterns from meals, poops, and mood this week</p>
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
            <h3>This week</h3>
            <p>Poop and mood at a glance</p>
          </div>
        </div>
        <div className="insight">
          <div className="row">
            <span>Poops logged</span>
            <strong>{weekPoops.length} across {daysWithPoop} day{daysWithPoop === 1 ? '' : 's'}</strong>
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
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Selected day</h3>
            <p>{formatLongDate(date)} — tap a day above to switch</p>
          </div>
        </div>
        <div className="insight">
          {(['meals', 'poops', 'moods'] as const).map((kind) => {
            const count =
              kind === 'meals'
                ? data.meals.filter((item) => item.date === date).length
                : kind === 'poops'
                  ? data.poops.filter((item) => item.date === date).length
                  : data.moods.filter((item) => item.date === date).length
            return (
              <div className="row" key={kind}>
                <span>{kind[0].toUpperCase() + kind.slice(1)}</span>
                <strong>{count || 'None'}</strong>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
