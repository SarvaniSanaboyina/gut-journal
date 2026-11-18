import { useMemo, useState } from 'react'
import {
  dateRange,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  monthCellsMonday,
  parseISODate,
  shiftDate,
  shiftMonth,
  todayISO,
  weekdayLabelsMonday,
} from '../dates'
import { associationSentence, BRISTOL_GROUPS, bristolGroup, findAssociations, formatGap, poopsByDay, stamp, SYMPTOMS, symptomLabel } from '../gut'
import { careNotices, DISCLAIMER } from '../safety'
import type { JournalData, PoopEntry, SymptomEntry, SymptomType } from '../types'
import { CareNotices, PoopRow, SymptomRow } from './GutEntries'
import { Chevron } from './Icons'

type Tab = 'bowel' | 'symptoms' | 'links'

function byNewest<T extends { date: string; time: string }>(items: T[]) {
  return [...items].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
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
  const [tab, setTab] = useState<Tab>('bowel')
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
          ['bowel', 'Bowel movements'],
          ['symptoms', 'Symptoms'],
          ['links', 'Food links'],
        ] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'bowel' && <BowelCalendar poops={data.poops} onEdit={onEditPoop} />}
      {tab === 'symptoms' && <SymptomList symptoms={data.symptoms} onEdit={onEditSymptom} />}
      {tab === 'links' && <FoodLinks data={data} onEdit={onEditSymptom} />}
      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  )
}
