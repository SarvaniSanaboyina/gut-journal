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
  // Dry fruits and the IFCT 2017 reference foods
  const catalogue = await call('GET', '/api/journal')
  const foodsById = new Map(catalogue.json.foods.map((f: any) => [f.id, f]))
  check('cashew, pista and anjir in the list', ['cashew', 'pista', 'anjir'].every((id) => (foodsById.get(id) as any)?.nutrientSource === 'ifct'))
  check('all 542 IFCT foods available as reference foods', catalogue.json.foods.filter((f: any) => f.isReference).length === 542)
  check('IFCT local names searchable (kaju)', (foodsById.get('ifct-h005') as any)?.aliases.includes('kaju'))

  // Recipe: nutrients are calculated on the server from the ingredients, whatever the client sends
  const cashew = foodsById.get('cashew') as any
  const milk = foodsById.get('milk') as any
  const recipe = await call('PUT', '/api/foods', {
    id: 'custom-kaju-milk', name: 'Kaju milk', category: 'beverages', groups: ['protein'], defaultUnit: 'pieces',
    nutrients: { energyKcal: 9999 },
    recipe: { ingredients: [
      { foodId: 'cashew', name: 'Cashew', quantity: 20, unit: 'g', grams: 20 },
      { foodId: 'milk', name: 'Milk', quantity: 200, unit: 'ml', grams: 206 },
    ], cookedGrams: 200, pieces: 2 },
  })
  const expectedKcal = ((cashew.nutrients.energyKcal * 20) / 100 + (milk.nutrients.energyKcal * 206) / 100) / 200 * 100
  check('recipe nutrients calculated from ingredients', recipe.status === 200 && Math.abs(recipe.json.nutrients.energyKcal - expectedKcal) < 0.01, recipe.json)
  check('recipe source, piece weight and ingredient links', recipe.json.nutrientSource === 'recipe' && recipe.json.unitGrams.pieces === 100 && recipe.json.ingredients.includes('cashew'))
  const noData = await call('PUT', '/api/foods', { id: 'custom-bad', name: 'Sweet', category: 'snacks', recipe: { ingredients: [{ foodId: 'mithai', name: 'Mithai', quantity: 50, unit: 'g', grams: 50 }] } })
  check('ingredient without nutrient data rejected', noData.status === 400)
  const unknownFood = await call('PUT', '/api/foods', { id: 'custom-bad', name: 'Sweet', category: 'snacks', recipe: { ingredients: [{ foodId: 'no-such-food', name: 'Nope', quantity: 50, unit: 'g', grams: 50 }] } })
  check('unknown ingredient rejected', unknownFood.status === 400)
  const self = await call('PUT', '/api/foods', { id: 'custom-kaju-milk', name: 'Kaju milk', category: 'beverages', recipe: { ingredients: [{ foodId: 'custom-kaju-milk', name: 'Kaju milk', quantity: 50, unit: 'g', grams: 50 }] } })
  check('recipe cannot include itself', self.status === 400)

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

  const tooMuch = await call('PUT', '/api/meals', { ...meal, id: 'meal-2', items: [{ ...meal.items[0], id: 'x1', quantityConsumed: 7, consumedPercent: null }] })
  check('eaten > 3x served rejected', tooMuch.status === 400, tooMuch.json)
  const seconds = await call('PUT', '/api/meals', { ...meal, id: 'meal-2', type: 'dinner', items: [{ ...meal.items[0], id: 'x1', quantityConsumed: 3, consumedPercent: null }] })
  check('second helpings (150%) accepted', seconds.status === 200 && seconds.json.items[0].consumedPercent === 150, seconds.json)
  await call('DELETE', '/api/meals/meal-2')
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

  // Meal schedule: explicit "not eaten" slots
  const skip = await call('PUT', '/api/meal-slots/2026-11-18/lunch', { status: 'not-eaten', note: 'asleep' })
  check('slot marked not eaten', skip.status === 200 && skip.json.status === 'not-eaten')
  const skipTaken = await call('PUT', '/api/meal-slots/2026-11-18/breakfast', { status: 'not-eaten' })
  check('not eaten refused while food is logged', skipTaken.status === 400)
  const badSlot = await call('PUT', '/api/meal-slots/2026-11-18/mini-snack', { status: 'not-eaten' })
  check('"Other" is not a scheduled slot', badSlot.status === 400)
  const badStatus = await call('PUT', '/api/meal-slots/2026-11-18/lunch', { status: 'eaten' })
  check('eaten cannot be set directly', badStatus.status === 400)
  const lunch = await call('PUT', '/api/meals', { ...meal, id: 'meal-lunch', type: 'lunch', time: '12:30', items: [{ ...meal.items[0], id: 'l1' }] })
  const afterLunch = await call('GET', '/api/journal')
  check('logging food clears not eaten', lunch.status === 200 && !afterLunch.json.mealSlots.some((slot: any) => slot.mealType === 'lunch'))
  const replace = await call('PUT', '/api/meal-slots/2026-11-18/lunch', { status: 'not-eaten', replaceMeals: true })
  const afterReplace = await call('GET', '/api/journal')
  check(
    'confirmed not eaten replaces logged food',
    replace.status === 200 && replace.json.removedMeals[0] === 'meal-lunch' && !afterReplace.json.meals.some((m: any) => m.id === 'meal-lunch'),
  )
  check('replaced meal kept a revision', (await db.prisma.recordRevision.count({ where: { entity: 'meal', entityId: 'meal-lunch', action: 'delete' } })) === 1)
  await call('PUT', '/api/meal-slots/2026-11-18/dinner', { status: 'not-eaten' })
  const cleared = await call('PUT', '/api/meal-slots/2026-11-18/dinner', { status: 'not-logged' })
  const afterClear = await call('GET', '/api/journal')
  check('slot reset to not logged', cleared.status === 200 && afterClear.json.mealSlots.length === 1)
  const assessment = await call('PUT', '/api/settings/nutrition-assessment', { lowPercent: 75, minCoveragePercent: 85, keyNutrients: ['energyKcal', 'ironMg'] })
  check('nutrition assessment settings saved', assessment.status === 200 && assessment.json.lowPercent === 75 && assessment.json.keyNutrients.length === 2)
  const badAssessment = await call('PUT', '/api/settings/nutrition-assessment', { lowPercent: 130, energyHighPercent: 120 })
  check('invalid assessment thresholds rejected', badAssessment.status === 400)
  const badNutrient = await call('PUT', '/api/settings/nutrition-assessment', { keyNutrients: ['sugar'] })
  check('unknown key nutrient rejected', badNutrient.status === 400)
  const zeroWater = await call('PUT', '/api/waters', { id: 'w0', date: '2026-11-18', time: '20:00', amount: 0, unit: 'ml' })
  check('explicit 0 ml water accepted', zeroWater.status === 200 && zeroWater.json.amount === 0)
  const negativeWater = await call('PUT', '/api/waters', { id: 'w1', date: '2026-11-18', time: '20:00', amount: -5, unit: 'ml' })
  check('negative water rejected', negativeWater.status === 400)

  // Phase 4: growth records
  const growth = await call('PUT', '/api/growth', { id: 'g-1', date: '2025-05-04', weightKg: 12.2, heightCm: 86.4, position: 'standing' })
  check('growth record saved', growth.status === 200 && growth.json.heightCm === 86.4 && growth.json.position === 'standing')
  const growthEmpty = await call('PUT', '/api/growth', { id: 'g-2', date: '2025-05-04' })
  check('growth record needs weight or height', growthEmpty.status === 400)
  const growthGrams = await call('PUT', '/api/growth', { id: 'g-3', date: '2025-05-04', weightKg: 0.5 })
  check('implausible weight rejected', growthGrams.status === 400)
  const growthEdit = await call('PUT', '/api/growth', { id: 'g-1', date: '2025-05-04', weightKg: 12.4, heightCm: 86.4, position: 'standing' })
  check('growth record updated', growthEdit.json.weightKg === 12.4)
  const growthRevisions = await db.prisma.recordRevision.count({ where: { entity: 'growth', entityId: 'g-1' } })
  check('growth edit kept a revision', growthRevisions === 1)

  const backup = await call('GET', '/api/export')
  check('export has only custom foods', backup.json.foods.every((f: any) => f.isCustom))
  const restored = await call('POST', '/api/import', backup.json)
  check('backup round-trip keeps meal items', restored.json.meals[0]?.items?.length >= 1, restored.json.meals)
  check('backup round-trip keeps symptoms', restored.json.symptoms[0]?.reactions?.length === 1 && restored.json.dailyMetrics.length === 1)
  check('backup round-trip keeps settings', restored.json.settings.childProfile.birthDate === '2023-05-04')
  check('backup round-trip keeps blood flag', restored.json.poops[0]?.visibleBlood === true)
  check('backup round-trip keeps not-eaten slots and assessment settings', restored.json.mealSlots.length === 1 && restored.json.settings.nutritionAssessment.lowPercent === 75)
  const restoredRecipe = restored.json.foods.find((f: any) => f.id === 'custom-kaju-milk')
  check('backup round-trip keeps recipe foods', restoredRecipe?.nutrientSource === 'recipe' && restoredRecipe.recipe.ingredients.length === 2 && restoredRecipe.nutrients.energyKcal > 0)
  check('backup round-trip keeps growth', restored.json.growth.length === 1 && restored.json.growth[0].weightKg === 12.4)

  const refuseWipe = await call('POST', '/api/delete-all', {})
  check('delete-all needs confirmation', refuseWipe.status === 400)
  const wiped = await call('POST', '/api/delete-all', { confirm: 'DELETE' })
  check(
    'delete-all clears journal',
    wiped.status === 200 && wiped.json.meals.length === 0 && wiped.json.poops.length === 0 && wiped.json.symptoms.length === 0 && wiped.json.growth.length === 0 && wiped.json.mealSlots.length === 0 && wiped.json.foods.every((f: any) => !f.isCustom),
  )
  check('delete-all clears settings', wiped.json.settings.childProfile.birthDate === '')
  check('delete-all clears edit history and photos', (await db.prisma.recordRevision.count()) === 0 && (await db.prisma.mealPhoto.count()) === 0)
  check('built-in foods remain after delete-all', wiped.json.foods.length > 50)
  const stillSignedIn = await call('GET', '/api/journal')
  check('login still works after delete-all', stillSignedIn.status === 200)
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
