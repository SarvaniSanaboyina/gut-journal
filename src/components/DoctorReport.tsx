import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, formatTime, shiftDate, todayISO } from '../dates'
import { FOOD_GROUPS } from '../foods'
import { BRISTOL_GROUPS, BRISTOL_TYPES, formatDurationMinutes, formatGap, stamp, symptomLabel } from '../gut'
import { formatZ, growthAssessments, growthNotes } from '../growth'
import { SLOTS } from '../mealSlots'
import { formatAge, formatNutrient, NUTRIENTS, NUTRIENT_ORDER, referenceValues } from '../nutrition'
import { summarisePeriod, type ReportRange } from '../reports'
import { careNotices, DISCLAIMER } from '../safety'
import type { JournalData } from '../types'

const SPANS = [
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const

/**
 * A one-document summary for a pediatrician visit. Rendered as a full-screen sheet and printed
 * with the browser's print dialog (which also saves as PDF). Nothing leaves the device unless the
 * parent chooses to print, save or share the PDF.
 */
export function DoctorReport({ data, childName, onClose }: { data: JournalData; childName: string; onClose: () => void }) {
  const today = todayISO()
  const [span, setSpan] = useState<number | 'custom'>(30)
  const [start, setStart] = useState(shiftDate(today, -29))
  const [end, setEnd] = useState(today)
  const [question, setQuestion] = useState('')
  const rangeStart = span === 'custom' ? (start <= end ? start : end) : shiftDate(today, -(span - 1))
  const rangeEnd = span === 'custom' ? end : today
  const range: ReportRange = useMemo(() => ({ start: rangeStart, end: rangeEnd }), [rangeStart, rangeEnd])
  const summary = useMemo(() => summarisePeriod(data, range), [data, range])
  const notices = useMemo(() => careNotices(data, range.end), [data, range.end])
  const growth = useMemo(() => growthAssessments(data), [data])
  const growthPoints = growth.filter((item) => !item.unavailable).slice(-6)
  const notes = growthNotes(growth)
  const profile = data.settings.childProfile
  const refs = referenceValues(data.settings, range.end)
  const symptoms = data.symptoms
    .filter((item) => item.date >= range.start && item.date <= range.end)
    .sort((a, b) => stamp(b.date, b.time) - stamp(a.date, a.time))
  const age = profile.birthDate ? formatAge(Math.floor((Date.parse(range.end) - Date.parse(profile.birthDate)) / (30.4375 * 86_400_000))) : null
  const total = summary.gut.bowelMovements

  useEffect(() => {
    document.body.classList.add('printing-report')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('printing-report')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="report-sheet" role="dialog" aria-modal="true" aria-label="Pediatrician report">
      <div className="report-controls no-print">
        <button type="button" className="ghost" onClick={onClose}>← Back</button>
        <label className="field">
          <span>Period</span>
          <select value={span} onChange={(event) => setSpan(event.target.value === 'custom' ? 'custom' : Number(event.target.value))}>
            {SPANS.map((item) => <option key={item.days} value={item.days}>{item.label}</option>)}
            <option value="custom">Custom range</option>
          </select>
        </label>
        {span === 'custom' && (
          <>
            <label className="field"><span>From</span><input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={end} max={today} onChange={(event) => setEnd(event.target.value || today)} /></label>
          </>
        )}
        <button type="button" className="primary" onClick={() => window.print()}>Print / Save PDF</button>
      </div>
      <p className="muted-note no-print report-help">Use “Save as PDF” in the print dialog to keep or share a copy. On a phone, use the Share button in the print preview.</p>

      <article className="report-doc">
        <header className="report-header">
          <div>
            <h1>Child health summary</h1>
            <p>{formatDate(range.start)} – {formatDate(range.end)} · {summary.days.length} days, {summary.trackedDays} with entries</p>
          </div>
          <dl>
            <div><dt>Child</dt><dd>{childName || '—'}</dd></div>
            <div><dt>Date of birth</dt><dd>{profile.birthDate ? formatDate(profile.birthDate) : 'Not recorded'}</dd></div>
            <div><dt>Age</dt><dd>{age ?? '—'}</dd></div>
            <div><dt>Sex</dt><dd>{profile.sex === 'female' ? 'Girl' : profile.sex === 'male' ? 'Boy' : 'Not recorded'}</dd></div>
            <div><dt>Prepared</dt><dd>{formatDate(today)}</dd></div>
          </dl>
        </header>
        <p className="report-disclaimer">Recorded by a parent or caregiver in a home journal. {DISCLAIMER} Nutrient values are estimates from food composition data.</p>

        <section className="report-question">
          <h2>Parent’s main concern</h2>
          <textarea className="no-print" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What would you like to ask the doctor? (printed with the report, not saved)" />
          <p className="print-only">{question || '—'}</p>
        </section>

        {notices.length > 0 && (
          <section>
            <h2>Flagged for attention (last 7 days of the period)</h2>
            <ul>{notices.map((notice) => <li key={notice.id}><strong>{notice.title}.</strong> {notice.body}</li>)}</ul>
          </section>
        )}

        <section>
          <h2>Growth</h2>
          {growthPoints.length === 0 ? (
            <p>No weight or height recorded{growth.length ? ' with a usable date of birth and sex' : ''}.</p>
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Age</th><th>Weight</th><th>Height / length</th><th>BMI</th></tr></thead>
              <tbody>
                {growthPoints.map((item) => (
                  <tr key={item.entry.id}>
                    <td>{formatDate(item.entry.date)}</td>
                    <td>{formatAge(Math.floor(item.ageDays / 30.4375))}</td>
                    <td>{item.weight ? `${item.weight.value} kg (${item.weight.percentile} centile, z ${formatZ(item.weight.z)})` : '—'}</td>
                    <td>{item.entry.heightCm != null ? `${item.entry.heightCm} cm${item.entry.position ? `, ${item.entry.position}` : ''}${item.height ? ` (${item.height.percentile} centile, z ${formatZ(item.height.z)})` : ''}` : '—'}</td>
                    <td>{item.bmi ? `${item.bmi.value.toFixed(1)} (z ${formatZ(item.bmi.z)})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {growthPoints.length > 0 && <p className="report-small">Percentiles and z-scores: WHO Child Growth Standards 0–5 years. Height measured standing under 2 y, or lying from 2 y, is corrected by 0.7 cm.</p>}
          {notes.length > 0 && <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
        </section>

        <section>
          <h2>Bowel movements</h2>
          {total === 0 ? (
            <p>None recorded in this period.</p>
          ) : (
            <>
              <p>
                {total} recorded over {summary.trackedDays} tracked days ({summary.gut.perTrackedDay?.toFixed(1)} per tracked day). Longest run of tracked days without one: {summary.gut.longestGap} day{summary.gut.longestGap === 1 ? '' : 's'}.
                {summary.gut.strainOrPain > 0 && ` Straining or pain with ${summary.gut.strainOrPain}.`}
                {summary.gut.mucus > 0 && ` Mucus noted ${summary.gut.mucus} time${summary.gut.mucus === 1 ? '' : 's'}.`}
                {summary.gut.blood > 0 && ` Blood, red or black stool noted ${summary.gut.blood} time${summary.gut.blood === 1 ? '' : 's'}.`}
              </p>
              <table className="compact">
                <thead><tr><th>Bristol type</th>{BRISTOL_TYPES.map((item) => <th key={item.type}>{item.type}</th>)}</tr></thead>
                <tbody>
                  <tr>
                    <th scope="row">Count</th>
                    {BRISTOL_TYPES.map((item) => <td key={item.type}>{summary.days.length ? data.poops.filter((poop) => poop.bristol === item.type && poop.date >= range.start && poop.date <= range.end).length : 0}</td>)}
                  </tr>
                </tbody>
              </table>
              <p className="report-small">
                {BRISTOL_GROUPS.map((group) => `${group.label} (${group.range}): ${Math.round((summary.gut.byGroup[group.id] / total) * 100)}%`).join(' · ')}
              </p>
            </>
          )}
        </section>

        <section>
          <h2>Symptoms</h2>
          {symptoms.length === 0 ? (
            <p>None recorded in this period.</p>
          ) : (
            <>
              <p>{summary.gut.symptomTypes.map((item) => `${item.name} ×${item.count}${item.severe ? ` (${item.severe} severe)` : ''}`).join(' · ')}</p>
              <table>
                <thead><tr><th>When</th><th>Symptom</th><th>Severity</th><th>Duration</th><th>Suspected food (parent)</th></tr></thead>
                <tbody>
                  {symptoms.slice(0, 25).map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date)} {formatTime(item.time)}</td>
                      <td>{symptomLabel(item)}{item.notes && <small> — {item.notes}</small>}</td>
                      <td>{item.severity}</td>
                      <td>{formatDurationMinutes(item.durationMinutes)}</td>
                      <td>
                        {item.reactions.length
                          ? item.reactions.map((reaction) => `${reaction.foodName} (${formatGap((stamp(item.date, item.time) - stamp(reaction.consumedDate, reaction.consumedTime)) / 60000)} before${reaction.previousSimilar === 'yes' ? ', happened before' : ''})`).join('; ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {symptoms.length > 25 && <p className="report-small">Showing the 25 most recent of {symptoms.length}.</p>}
            </>
          )}
        </section>

        {summary.reactions.associations.length > 0 && (
          <section>
            <h2>Repeated food → symptom sequences</h2>
            <p className="report-small">Foods eaten within 24 h before the same symptom on 2 or more occasions. These are time sequences found in the log, not tested reactions or allergies.</p>
            <ul>
              {summary.reactions.associations.map((item) => (
                <li key={`${item.key}-${item.symptomType}`}>
                  {item.foodName} → {item.symptomName.toLowerCase()}: {item.occasions} of {item.exposures} times eaten, typically {formatGap(item.medianGapMinutes)} later{item.parentMarked ? `; marked by parent ${item.parentMarked}×` : ''}.
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>Eating and nutrition</h2>
          {summary.eating.meals === 0 ? (
            <p>No meals recorded in this period.</p>
          ) : (
            <>
              <p>
                {summary.eating.meals} meals on {summary.eating.mealDays} days ({summary.eating.mealsPerDay?.toFixed(1)} per day).
                {summary.eating.averageEatenPercent != null && ` On average about ${Math.round(summary.eating.averageEatenPercent)}% of food served was eaten.`}
                {' '}{summary.eating.distinctFoods} different foods.
                {summary.eating.refusedFoods.length > 0 && ` Most often refused: ${summary.eating.refusedFoods.map((item) => `${item.name} (${item.count})`).join(', ')}.`}
                {summary.eating.newFoods.length > 0 && ` New foods: ${summary.eating.newFoods.slice(0, 8).join(', ')}.`}
              </p>
              <p className="report-small">
                Food groups — days recorded out of {summary.eating.mealDays}: {FOOD_GROUPS.map((group) => `${group.label} ${summary.nutrition.groupDays[group.id]}`).join(' · ')}
              </p>
              <table>
                <thead><tr><th>Estimated daily average</th><th>Amount</th><th>Reference ({refs.band} y)</th><th>% of reference</th></tr></thead>
                <tbody>
                  {NUTRIENT_ORDER.map((key) => {
                    const value = summary.nutrition.average[key]
                    const reference = refs.values[key]
                    return (
                      <tr key={key}>
                        <th scope="row">{NUTRIENTS[key].label}</th>
                        <td>{value.unknown ? '≥ ' : ''}{formatNutrient(key, value.value)}</td>
                        <td>{reference == null ? '—' : formatNutrient(key, reference)}</td>
                        <td>{reference ? `${Math.round((value.value / reference) * 100)}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="report-small">Averaged over {summary.nutrition.loggedDays} days with meals logged. “≥” means some foods had no amount or no composition data and were left out. References: {refs.note}</p>
            </>
          )}
          <p className="report-small">
            Meal schedule (3 meals + 2 snacks): all five recorded on {summary.schedule.completeDays} days, partly on {summary.schedule.incompleteDays}, not recorded on {summary.schedule.noLogDays}.
            {summary.schedule.avgEaten != null && ` On recorded days, ${summary.schedule.avgEaten.toFixed(1)} meals eaten and ${summary.schedule.avgSkipped!.toFixed(1)} skipped on average.`}
            {SLOTS.some((slot) => summary.schedule.skippedBySlot[slot.id] > 0) &&
              ` Skipped: ${SLOTS.filter((slot) => summary.schedule.skippedBySlot[slot.id] > 0).map((slot) => `${slot.label.toLowerCase()} ${summary.schedule.skippedBySlot[slot.id]}×`).join(', ')}.`}
          </p>
          <p className="report-small">
            {summary.hydration.daysRecorded
              ? `Water: ${Math.round(summary.hydration.averageMl!)} ml per day on average over ${summary.hydration.daysRecorded} days with a record (${summary.hydration.daysMissing} days not recorded).`
              : 'Water: not recorded in this period.'}
          </p>
        </section>

        {summary.checkIns.days > 0 && (
          <section>
            <h2>Daily check-ins</h2>
            <p>
              {summary.checkIns.days} check-ins.
              {summary.checkIns.averageSleep != null && ` Average sleep ${summary.checkIns.averageSleep.toFixed(1)} h.`}
              {` Low appetite on ${summary.checkIns.lowAppetiteDays} day${summary.checkIns.lowAppetiteDays === 1 ? '' : 's'}, low energy on ${summary.checkIns.lowEnergyDays}.`}
            </p>
          </section>
        )}

        <footer className="report-footer">Generated from a home tracking journal. Not a medical record or diagnosis.</footer>
      </article>
    </div>,
    document.body,
  )
}
