import { useMemo, useState } from 'react'
import {
  dateRange,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatWeekday,
  monthCellsMonday,
  parseISODate,
  shiftDate,
  shiftMonth,
  todayISO,
  weekdayLabelsMonday,
} from '../dates'
import {
  associationSentence,
  BRISTOL_GROUPS,
  BRISTOL_TYPES,
  bristolGroup,
  bristolGroupMeta,
  findAssociations,
  formatGap,
  gutObservations,
  gutStats,
  poopsByDay,
  stamp,
  SYMPTOMS,
  symptomLabel,
} from '../gut'
import { careNotices, DISCLAIMER } from '../safety'
import type { JournalData, PoopEntry, SymptomEntry, SymptomType } from '../types'
import { BarList, ColumnChart } from './Charts'
import { CareNotices, PoopRow, SymptomRow } from './GutEntries'
import { Chevron } from './Icons'

type Tab = 'overview' | 'bowel' | 'symptoms' | 'links'
type Span = 'day' | 'week' | 'month' | 'custom'

function byNewest<T extends { date: string; time: string }>(items: T[]) {
  return [...items].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
}

function Overview({ data, onEdit }: { data: JournalData; onEdit: (entry: SymptomEntry) => void }) {
  const today = todayISO()
  const [span, setSpan] = useState<Span>('week')
  const [start, setStart] = useState(shiftDate(today, -13))
  const [end, setEnd] = useState(today)
  const [filter, setFilter] = useState<SymptomType | 'all'>('all')
  const days = useMemo(() => {
    if (span === 'day') return [end]
    if (span === 'week') return dateRange(shiftDate(end, -6), end)
    if (span === 'month') return dateRange(shiftDate(end, -29), end)
    return start <= end ? dateRange(start, end) : []
  }, [span, start, end])
  const previousDays = useMemo(() => days.map((day) => shiftDate(day, -days.length)), [days])
  const stats = useMemo(() => gutStats(data, days, filter), [data, days, filter])
  const previous = useMemo(() => (span === 'day' ? null : gutStats(data, previousDays, filter)), [data, previousDays, filter, span])
  const observations = useMemo(() => gutObservations(stats, previous), [stats, previous])
  const symptomCounts = SYMPTOMS.map((item) => ({ ...item, count: stats.symptoms.filter((symptom) => symptom.type === item.id).length })).filter((item) => item.count > 0)
  const reactions = stats.symptoms.flatMap((symptom) => symptom.reactions.map((reaction) => ({ symptom, reaction })))
  const long = days.length > 14

  return (
    <>
      <div className="filter-row">
        <label className="field">
          <span>Period</span>
          <select value={span} onChange={(event) => setSpan(event.target.value as Span)}>
            <option value="day">One day</option>
            <option value="week">7 days</option>
            <option value="month">30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {span === 'custom' && (
          <label className="field">
            <span>From</span>
            <input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} />
          </label>
        )}
        <label className="field">
          <span>{span === 'custom' ? 'To' : span === 'day' ? 'Day' : 'Ending'}</span>
          <input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value || today)} />
        </label>
        <label className="field">
          <span>Symptom</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as SymptomType | 'all')}>
            <option value="all">All symptoms</option>
            {SYMPTOMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile"><span>Bowel movements</span><strong>{stats.poops.length}</strong></div>
        <div className="stat-tile"><span>Per day</span><strong>{stats.poops.length ? Math.round(stats.perDay * 10) / 10 : '—'}</strong></div>
        <div className="stat-tile"><span>Symptoms</span><strong>{stats.symptoms.length}</strong></div>
        <div className="stat-tile"><span>Suspected foods</span><strong>{reactions.length}</strong></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>What the log shows</h3>
            <p>{span === 'day' ? formatLongDate(end) : `${formatShortDate(days[0] ?? end)} – ${formatShortDate(end)}${previous ? ', compared with the period before' : ''}`}</p>
          </div>
        </div>
        <ul className="observations">{observations.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      {span !== 'day' && days.length > 1 && (
        <section className="section">
          <ColumnChart
            title="Bowel movements per day"
            subtitle="Coloured by stool type group"
            series={BRISTOL_GROUPS.map((group) => ({ id: group.id, label: group.label, color: group.color }))}
            columns={days.map((day, index) => ({
              key: day,
              label: long ? (index % 5 === 0 || index === days.length - 1 ? String(Number(day.slice(8))) : '') : formatWeekday(day),
              full: formatLongDate(day),
              values: Object.fromEntries(BRISTOL_GROUPS.map((group) => [group.id, stats.poops.filter((poop) => poop.date === day && bristolGroup(poop.bristol) === group.id).length])),
            }))}
          />
        </section>
      )}

      <section className="section">
        <BarList
          title="Stool type distribution"
          subtitle="Bristol stool scale, types 1–7"
          rows={BRISTOL_TYPES.map((item) => {
            const group = bristolGroupMeta(item.group)
            return { key: String(item.type), label: <>Type {item.type} <small>{item.hint}</small></>, text: `Type ${item.type} (${item.hint})`, value: stats.byType[item.type], color: group.color }
          })}
        />
      </section>

      <section className="section">
        {symptomCounts.length === 0 ? (
          <>
            <div className="section-head"><div><h3>Symptom frequency</h3></div></div>
            <div className="empty">No {filter === 'all' ? '' : `${symptomLabel({ type: filter, otherLabel: '' }).toLowerCase()} `}symptoms recorded in this period.</div>
          </>
        ) : (
          <BarList
            title="Symptom frequency"
            subtitle={filter === 'all' ? 'All symptom types' : `Filtered to ${symptomLabel({ type: filter, otherLabel: '' }).toLowerCase()}`}
            rows={symptomCounts.map((item) => ({
              key: item.id,
              label: <>{item.icon} {item.label}</>,
              text: item.label,
              value: item.count,
              color: '#7b5cb0',
              note: (() => {
                const severe = stats.symptoms.filter((symptom) => symptom.type === item.id && symptom.severity === 'severe').length
                return severe ? ` · ${severe} severe` : ''
              })(),
            }))}
          />
        )}
      </section>

      {reactions.length > 0 && (
        <section className="section">
          <div className="section-head"><div><h3>Food reactions in this period</h3><p>Foods marked as suspected — possible links only</p></div></div>
          <div className="reaction-table">
            {reactions.map(({ symptom, reaction }) => (
              <button key={reaction.id} type="button" className="reaction-row" onClick={() => onEdit(symptom)}>
                <span><strong>{reaction.foodName}</strong><small>eaten {formatShortDate(reaction.consumedDate)}</small></span>
                <span>{symptomLabel(symptom)}<small>{formatGap((stamp(symptom.date, symptom.time) - stamp(reaction.consumedDate, reaction.consumedTime)) / 60000)} later</small></span>
                <span className={`severity-pill ${reaction.severity}`}>{reaction.severity}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function BowelCalendar({
  poops,
  onEdit,
}: {
  poops: PoopEntry[]
  onEdit: (entry: PoopEntry) => void
}) {
  const today = todayISO()
  const [month, setMonth] = useState(() => {
    const date = parseISODate(today)
    return { year: date.getFullYear(), month: date.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<'calendar' | 'timeline'>('calendar')
  const byDay = useMemo(() => poopsByDay(poops), [poops])
  const cells = useMemo(() => monthCellsMonday(month.year, month.month), [month])
  const weekdays = useMemo(() => weekdayLabelsMonday(), [])
  const current = parseISODate(today)
  const atCurrentMonth = month.year === current.getFullYear() && month.month === current.getMonth()
  const dayEntries = [...(byDay.get(selected) ?? [])].sort((a, b) => a.time.localeCompare(b.time))
  const timeline = byNewest(poops.filter((item) => item.date >= shiftDate(today, -29)))

  return (
    <>
      <div className="toolbar">
        <button className={mode === 'calendar' ? 'active' : undefined} onClick={() => setMode('calendar')}>Calendar</button>
        <button className={mode === 'timeline' ? 'active' : undefined} onClick={() => setMode('timeline')}>Timeline</button>
      </div>

      {mode === 'calendar' ? (
        <>
          <section className="calendar">
            <div className="calendar-head">
              <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth((value) => shiftMonth(value.year, value.month, -1))}>
                <Chevron dir="left" />
              </button>
              <h2>{formatMonthYear(month.year, month.month)}</h2>
              <button className="icon-btn" aria-label="Next month" disabled={atCurrentMonth} onClick={() => setMonth((value) => shiftMonth(value.year, value.month, 1))}>
                <Chevron dir="right" />
              </button>
            </div>
            <div className="calendar-weekdays">
              {weekdays.map((label, index) => <span key={index}>{label}</span>)}
            </div>
            <div className="calendar-grid">
              {cells.map((iso, index) => {
                if (!iso) return <span className="calendar-blank" key={`blank-${index}`} />
                const entries = byDay.get(iso) ?? []
                return (
                  <button
                    key={iso}
                    className={`calendar-day bowel-day ${selected === iso ? 'selected' : ''} ${iso === today ? 'today' : ''}`}
                    disabled={iso > today}
                    aria-pressed={selected === iso}
                    aria-label={`${formatLongDate(iso)}: ${entries.length} bowel movement${entries.length === 1 ? '' : 's'}`}
                    onClick={() => setSelected(iso)}
                  >
                    <span>{parseISODate(iso).getDate()}</span>
                    {entries.length > 0 && (
                      <span className="bowel-dots">
                        {entries.slice(0, 3).map((entry) => (
                          <i key={entry.id} style={{ background: BRISTOL_GROUPS.find((group) => group.id === bristolGroup(entry.bristol))!.color }} />
                        ))}
                        {entries.length > 3 && <b>+</b>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="legend">
              {BRISTOL_GROUPS.map((group) => (
                <span key={group.id}><i style={{ background: group.color }} />{group.label}</span>
              ))}
            </div>
          </section>
          <section className="section">
            <div className="section-head">
              <div>
                <h3>{formatLongDate(selected)}</h3>
                <p>{dayEntries.length ? `${dayEntries.length} bowel movement${dayEntries.length === 1 ? '' : 's'}` : 'No bowel movements logged'}</p>
              </div>
            </div>
            <div className="entry-list">
              {dayEntries.map((entry) => <PoopRow key={entry.id} entry={entry} onSelect={() => onEdit(entry)} />)}
            </div>
          </section>
        </>
      ) : (
        <section className="section">
          <div className="section-head">
            <div>
              <h3>Last 30 days</h3>
              <p>Newest first. Tap an entry to edit it.</p>
            </div>
          </div>
          {timeline.length === 0 ? (
            <div className="empty">No bowel movements logged in the last 30 days.</div>
          ) : (
            <div className="entry-list">
              {timeline.map((entry) => (
                <PoopRow key={entry.id} entry={entry} showDate={formatShortDate(entry.date)} onSelect={() => onEdit(entry)} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

function SymptomList({ symptoms, onEdit }: { symptoms: SymptomEntry[]; onEdit: (entry: SymptomEntry) => void }) {
  const [filter, setFilter] = useState<SymptomType | 'all'>('all')
  const recent = byNewest(symptoms).filter((item) => filter === 'all' || item.type === filter)
  const used = new Set(symptoms.map((item) => item.type))
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h3>Symptom log</h3>
          <p>Every symptom you recorded, newest first</p>
        </div>
      </div>
      <div className="shelf-tabs" style={{ marginBottom: 12 }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        {SYMPTOMS.filter((item) => used.has(item.id)).map((item) => (
          <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>
      {recent.length === 0 ? (
        <div className="empty">No symptoms recorded. Use “Symptom” on the diary when you notice something.</div>
      ) : (
        <div className="entry-list">
          {recent.map((entry) => <SymptomRow key={entry.id} entry={entry} showDate={formatShortDate(entry.date)} onSelect={() => onEdit(entry)} />)}
        </div>
      )}
    </section>
  )
}

function FoodLinks({ data, onEdit }: { data: JournalData; onEdit: (entry: SymptomEntry) => void }) {
  const today = todayISO()
  const [span, setSpan] = useState(30)
  const [windowHours, setWindowHours] = useState(6)
  const days = useMemo(() => new Set(dateRange(shiftDate(today, -(span - 1)), today)), [span, today])
  const associations = useMemo(() => findAssociations(data, days, windowHours), [data, days, windowHours])
  const reactions = byNewest(data.symptoms.filter((item) => item.reactions.length > 0))

  return (
    <>
      <section className="section">
        <div className="section-head">
          <div>
            <h3>Possible associations</h3>
            <p>Foods recorded before the same symptom more than once</p>
          </div>
        </div>
        <div className="filter-row">
          <label className="field">
            <span>Period</span>
            <select value={span} onChange={(event) => setSpan(Number(event.target.value))}>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
          <label className="field">
            <span>Food eaten within</span>
            <select value={windowHours} onChange={(event) => setWindowHours(Number(event.target.value))}>
              <option value={2}>2 hours before</option>
              <option value={6}>6 hours before</option>
              <option value={24}>24 hours before</option>
            </select>
          </label>
        </div>
        {associations.length === 0 ? (
          <div className="empty">No food has been recorded before the same symptom more than once in this period.</div>
        ) : (
          <ul className="observations">
            {associations.slice(0, 8).map((item) => (
              <li key={`${item.key}-${item.symptomType}-${item.symptomName}`}>
                {associationSentence(item, windowHours)}
                {item.parentMarked > 0 && <> You marked it as suspected {item.parentMarked === 1 ? 'once' : `${item.parentMarked} times`}.</>}
              </li>
            ))}
          </ul>
        )}
        <p className="disclaimer">
          These are timing patterns, not allergy or intolerance tests. A food eaten often will appear before many symptoms by chance.
          Please don’t remove foods from your child’s diet on the basis of this list alone — discuss repeated patterns with your pediatrician.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Food reaction history</h3>
            <p>Foods you marked as suspected when logging a symptom</p>
          </div>
        </div>
        {reactions.length === 0 ? (
          <div className="empty">Nothing marked yet. When you log a symptom, tap “Suspect a food?” to record a possible link.</div>
        ) : (
          <div className="reaction-table" role="table" aria-label="Food reaction history">
            {reactions.flatMap((symptom) =>
              symptom.reactions.map((reaction) => {
                const gap = (stamp(symptom.date, symptom.time) - stamp(reaction.consumedDate, reaction.consumedTime)) / 60000
                return (
                  <button key={reaction.id} type="button" className="reaction-row" role="row" onClick={() => onEdit(symptom)}>
                    <span role="cell">
                      <strong>{reaction.foodName}</strong>
                      <small>eaten {formatShortDate(reaction.consumedDate)}</small>
                    </span>
                    <span role="cell">
                      {symptomLabel(symptom)} <span className={`severity-pill ${reaction.severity}`}>{reaction.severity}</span>
                      <small>{formatGap(gap)} later</small>
                    </span>
                    <span role="cell" className="muted-note">
                      {reaction.previousSimilar === 'yes' ? 'Happened before' : reaction.previousSimilar === 'no' ? 'First time' : 'Not sure if before'}
                    </span>
                  </button>
                )
              }),
            )}
          </div>
        )}
      </section>
    </>
  )
}

export function GutView({
  data,
  onEditPoop,
  onEditSymptom,
  onAddPoop,
  onAddSymptom,
}: {
  data: JournalData
  onEditPoop: (entry: PoopEntry) => void
  onEditSymptom: (entry: SymptomEntry) => void
  onAddPoop: () => void
  onAddSymptom: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const notices = useMemo(() => careNotices(data, todayISO()), [data])

  return (
    <>
      <div className="quick-log two">
        <button type="button" onClick={onAddPoop}><span className="qi" aria-hidden="true">🚽</span>Log poop</button>
        <button type="button" onClick={onAddSymptom}><span className="qi" aria-hidden="true">🩹</span>Log symptom</button>
      </div>
      <CareNotices notices={notices} />
      <div className="segmented" role="tablist" aria-label="Gut health sections">
        {([
          ['overview', 'Overview'],
          ['bowel', 'Bowel log'],
          ['symptoms', 'Symptoms'],
          ['links', 'Food links'],
        ] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview data={data} onEdit={onEditSymptom} />}
      {tab === 'bowel' && <BowelCalendar poops={data.poops} onEdit={onEditPoop} />}
      {tab === 'symptoms' && <SymptomList symptoms={data.symptoms} onEdit={onEditSymptom} />}
      {tab === 'links' && <FoodLinks data={data} onEdit={onEditSymptom} />}
      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  )
}
