import { shiftDate } from './dates'
import { bristolGroup } from './gut'
import type { JournalData } from './types'

export const DISCLAIMER =
  'For tracking and information only — not a medical diagnosis. Patterns here are observations to discuss with your pediatrician.'

export type CareNotice = { id: string; level: 'urgent' | 'discuss'; title: string; body: string }

const DEHYDRATION =
  'Watch for signs of dehydration: fewer wet nappies or trips to the toilet, a dry mouth, no tears when crying, or unusual sleepiness.'

/**
 * Observations that deserve a doctor's opinion, based on the 7 days ending `endISO`.
 * They prompt evaluation; they never name a condition.
 */
export function careNotices(data: JournalData, endISO: string): CareNotice[] {
  const startISO = shiftDate(endISO, -6)
  const inRange = (date: string) => date >= startISO && date <= endISO
  const poops = data.poops.filter((item) => inRange(item.date))
  const symptoms = data.symptoms.filter((item) => inRange(item.date))
  const notices: CareNotice[] = []

  const blood = poops.filter((item) => item.visibleBlood || item.color === 'red' || item.color === 'black')
  if (blood.length) {
    notices.push({
      id: 'blood',
      level: 'urgent',
      title: 'Blood or black stool recorded',
      body: `Recorded ${blood.length === 1 ? 'once' : `${blood.length} times`} in the last 7 days. Please contact your pediatrician — blood or black stool should always be checked by a doctor.`,
    })
  }
  if (poops.some((item) => item.color === 'pale')) {
    notices.push({
      id: 'pale',
      level: 'urgent',
      title: 'Pale or clay-coloured stool recorded',
      body: 'Pale, white or clay-coloured stool should be checked by your pediatrician soon.',
    })
  }

  const looseByDay = new Map<string, number>()
  for (const poop of poops) {
    if (bristolGroup(poop.bristol) === 'loose') looseByDay.set(poop.date, (looseByDay.get(poop.date) ?? 0) + 1)
  }
  for (const symptom of symptoms) {
    if (symptom.type === 'diarrhoea') looseByDay.set(symptom.date, Math.max(looseByDay.get(symptom.date) ?? 0, 1))
  }
  let streak = 0
  let longest = 0
  for (let day = startISO; day <= endISO; day = shiftDate(day, 1)) {
    streak = looseByDay.has(day) ? streak + 1 : 0
    longest = Math.max(longest, streak)
  }
  const busyDay = Math.max(0, ...looseByDay.values())
  if (longest >= 3 || busyDay >= 4) {
    notices.push({
      id: 'loose',
      level: 'discuss',
      title: 'Loose stools on several days',
      body: `${longest >= 3 ? `Loose or watery stools were recorded on ${longest} days in a row.` : `Up to ${busyDay} loose stools were recorded in one day.`} If this continues, contact your pediatrician. ${DEHYDRATION}`,
    })
  }

  if (symptoms.some((item) => item.type === 'stomach-pain' && item.severity === 'severe')) {
    notices.push({
      id: 'pain',
      level: 'urgent',
      title: 'Severe stomach pain recorded',
      body: 'Severe or persistent tummy pain needs prompt medical advice, especially with fever, vomiting, a swollen tummy, or if your child cannot be comforted.',
    })
  }
  const vomitByDay = new Map<string, number>()
  for (const item of symptoms.filter((entry) => entry.type === 'vomiting')) {
    vomitByDay.set(item.date, (vomitByDay.get(item.date) ?? 0) + (item.severity === 'severe' ? 3 : 1))
  }
  if ([...vomitByDay.values()].some((count) => count >= 3)) {
    notices.push({
      id: 'vomit',
      level: 'urgent',
      title: 'Repeated or severe vomiting recorded',
      body: `Contact your pediatrician about repeated vomiting. ${DEHYDRATION}`,
    })
  }

  const recent = data.poops.filter((item) => item.date >= shiftDate(endISO, -20) && item.date <= endISO)
  const tracking = recent.length >= 4
  const lastPoop = [...data.poops].filter((item) => item.date <= endISO).sort((a, b) => b.date.localeCompare(a.date))[0]
  const hard = poops.filter((item) => bristolGroup(item.bristol) === 'hard' || item.pain || item.straining).length
  if (tracking && lastPoop && lastPoop.date < shiftDate(endISO, -3)) {
    notices.push({
      id: 'gap',
      level: 'discuss',
      title: 'No bowel movement recorded for a few days',
      body: 'No poop has been logged for more than 3 days. If this is accurate and your child is uncomfortable, mention it to your pediatrician.',
    })
  } else if (hard >= 3) {
    notices.push({
      id: 'hard',
      level: 'discuss',
      title: 'Hard stools or straining recorded often',
      body: `${hard} hard, painful or strained bowel movements were recorded this week. Worth mentioning to your pediatrician if it continues.`,
    })
  }
  return notices
}
