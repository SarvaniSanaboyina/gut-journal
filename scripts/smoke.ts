/**
 * API smoke test against a throwaway PGlite database: `pnpm test:api`.
 * Exercises validation, nested meal items, edit history and backup round-trips.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createApp } from '../server/app.ts'
import { openDatabase } from '../server/db.ts'

const dir = mkdtempSync(join(tmpdir(), 'gut-journal-smoke-'))
const db = await openDatabase(dir, '')
const server = createApp(db.prisma).listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
let cookie = ''
let failures = 0

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: response.status, json: json as any }
}

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${label}`)
  else {
    failures += 1
    console.log(`  FAIL ${label}`, detail ?? '')
  }
}

try {
  await call('POST', '/api/auth/setup', { name: 'Asha', birthDate: '2023-05-04' })
  check('signed in', cookie.length > 0)

  const journal = await call('GET', '/api/journal')
  check('catalogue seeded', journal.json.foods.length > 60, journal.json.foods?.length)
  check('idli in catalogue', journal.json.foods.some((f: any) => f.id === 'idli'))

  const food = await call('PUT', '/api/foods', {
    id: 'custom-1', name: 'Grandma laddoo', category: 'snacks', groups: ['fat'], defaultUnit: 'pieces',
    unitGrams: { pieces: 30 }, nutrients: { energyKcal: 420, proteinG: 8 },
  })
  check('custom food saved', food.status === 200 && food.json.nutrientSource === 'label', food.json)
  const builtIn = await call('PUT', '/api/foods', { id: 'idli', name: 'Idli', category: 'cereals' })
  check('built-in food protected', builtIn.status === 400)

  const meal = {
    id: 'meal-1', date: '2026-11-18', time: '08:00', endTime: '', type: 'breakfast', foods: '',
    quantity: null, quantityUnit: 'spoons', consistency: 'solid', consistencyPercent: null, calories: null,
    notes: '', hasBeforePhoto: false, hasAfterPhoto: false, source: 'homemade',
    items: [
      { id: 'i1', foodId: 'idli', name: 'Idli', quantityServed: 2, quantityConsumed: 1.5, unit: 'pieces', consumedPercent: 75, preparation: 'Steamed', notes: '', ingredients: [] },
      { id: 'i2', foodId: 'sambar', name: 'Sambar', quantityServed: 0.5, quantityConsumed: null, unit: 'bowls', consumedPercent: 50, preparation: '', notes: '',
        ingredients: [{ id: 'i2a', foodId: 'drumstick', name: 'Drumstick', quantityServed: null, quantityConsumed: null, unit: 'pieces', consumedPercent: null, preparation: '', notes: '' }] },
      { id: 'i3', foodId: 'custom-1', name: 'Grandma laddoo', quantityServed: 1, quantityConsumed: 0, unit: 'pieces', consumedPercent: 0, preparation: '', notes: '', ingredients: [] },
    ],
  }
  const saved = await call('PUT', '/api/meals', meal)
  check('meal with items saved', saved.status === 200 && saved.json.items.length === 3, saved.json)
  check('legacy foods text derived', saved.json.foods === 'Idli, Sambar, Grandma laddoo', saved.json.foods)
  check('ingredient nested', saved.json.items[1]?.ingredients?.[0]?.name === 'Drumstick')
  check('percent derived from quantities', saved.json.items[0]?.consumedPercent === 75)

  const tooMuch = await call('PUT', '/api/meals', { ...meal, id: 'meal-2', items: [{ ...meal.items[0], id: 'x1', quantityConsumed: 3 }] })
  check('eaten > served rejected', tooMuch.status === 400, tooMuch.json)
  const empty = await call('PUT', '/api/meals', { ...meal, id: 'meal-3', items: [] })
  check('meal without foods rejected', empty.status === 400)
  const badDate = await call('PUT', '/api/meals', { ...meal, id: 'meal-4', date: '2026-02-30' })
  check('invalid date rejected', badDate.status === 400)

  const edited = await call('PUT', '/api/meals', { ...meal, items: [meal.items[0]] })
  check('meal edited', edited.json.items.length === 1)
  const revisions = await db.prisma.recordRevision.findMany({ where: { entityId: 'meal-1' } })
  check('edit history kept', revisions.length === 1 && (revisions[0].data as any).items.length === 3)

  await call('DELETE', '/api/foods/custom-1')
  const afterFoodDelete = await call('GET', '/api/journal')
  check('custom food deleted', !afterFoodDelete.json.foods.some((f: any) => f.id === 'custom-1'))

  // Phase 2: gut health
  const poop = await call('PUT', '/api/poops', { id: 'p1', date: '2026-11-18', time: '18:00', bristol: 5, color: 'brown', amount: 'medium', visibleBlood: true })
  check('poop with visible blood saved', poop.status === 200 && poop.json.visibleBlood === true, poop.json)
  const badBristol = await call('PUT', '/api/poops', { id: 'p2', date: '2026-11-18', time: '18:00', bristol: 8 })
  check('bristol 8 rejected', badBristol.status === 400)
  const symptom = {
    id: 's1', date: '2026-11-18', time: '16:30', type: 'bloating', severity: 'mild', durationMinutes: 45, notes: '',
    reactions: [{ id: 'r1', foodId: 'idli', mealId: 'meal-1', foodName: 'Idli', consumedDate: '2026-11-18', consumedTime: '08:00', previousSimilar: 'yes' }],
  }
  const savedSymptom = await call('PUT', '/api/symptoms', symptom)
  check('symptom with suspected food saved', savedSymptom.status === 200 && savedSymptom.json.reactions.length === 1, savedSymptom.json)
  check('reaction inherits severity', savedSymptom.json.reactions?.[0]?.severity === 'mild')
  const future = await call('PUT', '/api/symptoms', { ...symptom, id: 's2', reactions: [{ ...symptom.reactions[0], id: 'r2', consumedTime: '17:00' }] })
  check('food eaten after symptom rejected', future.status === 400)
  const other = await call('PUT', '/api/symptoms', { ...symptom, id: 's3', type: 'other', reactions: [] })
  check('other symptom needs a label', other.status === 400)
  const metric = await call('PUT', '/api/daily/2026-11-18', { appetite: 'low', energy: 'normal', sleepHours: 11 })
  check('daily check-in saved', metric.status === 200 && metric.json.appetite === 'low')
  const badMetric = await call('PUT', '/api/daily/2026-11-18', { sleepHours: 30 })
  check('sleep over 24h rejected', badMetric.status === 400)
  const gut = await call('GET', '/api/journal')
  check('journal returns symptoms and check-ins', gut.json.symptoms.length === 1 && gut.json.dailyMetrics.length === 1)
  const mealDelete = await call('DELETE', '/api/meals/meal-1')
  const afterMealDelete = await call('GET', '/api/journal')
  check('deleting a meal keeps the suspected food', mealDelete.status === 204 && afterMealDelete.json.symptoms[0].reactions[0].mealId === null)
  await call('PUT', '/api/meals', meal)


  // Phase 3: settings
  const profile = await call('PUT', '/api/settings/child-profile', { sex: 'female', birthDate: '2023-05-04' })
  check('child profile saved', profile.status === 200 && profile.json.sex === 'female')
  const badSex = await call('PUT', '/api/settings/child-profile', { sex: 'x' })
  check('invalid sex rejected', badSex.status === 400)
  const refs = await call('PUT', '/api/settings/nutrient-references', { custom: { ironMg: 9, bogus: 3 } })
  check('custom reference saved, unknown keys dropped', refs.json.custom.ironMg === 9 && !('bogus' in refs.json.custom))
  const unknown = await call('PUT', '/api/settings/theme', {})
  check('unknown setting rejected', unknown.status === 400)

  const backup = await call('GET', '/api/export')
  check('export has only custom foods', backup.json.foods.every((f: any) => f.isCustom))
  const restored = await call('POST', '/api/import', backup.json)
  check('backup round-trip keeps meal items', restored.json.meals[0]?.items?.length >= 1, restored.json.meals)
  check('backup round-trip keeps symptoms', restored.json.symptoms[0]?.reactions?.length === 1 && restored.json.dailyMetrics.length === 1)
  check('backup round-trip keeps settings', restored.json.settings.childProfile.birthDate === '2023-05-04')
  check('backup round-trip keeps blood flag', restored.json.poops[0]?.visibleBlood === true)
} finally {
  server.close()
  await db.prisma.$disconnect()
  await db.close()
  rmSync(dir, { recursive: true, force: true })
}

if (failures) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
console.log('All API checks passed')
