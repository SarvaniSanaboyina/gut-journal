import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AuthError,
  deleteAllData as wipeServer,
  deleteFood,
  deleteGrowth,
  deleteMeal,
  deleteSymptom,
  deleteMood,
  deletePoop,
  deleteWater,
  downloadExport,
  getJournal,
  importJournal,
  OfflineError,
  putDailyMetric,
  putMealSlot,
  putSetting,
  type SlotChange,
  setNote,
  upsertSymptom as saveSymptom,
  upsertGrowth as saveGrowth,
  upsertFood as saveFood,
  upsertMeal as saveMeal,
  upsertMood as saveMood,
  upsertPoop as savePoop,
  upsertWater as saveWater,
} from './api'
import { attachLegacyPhotos, clearLegacyPhotos } from './legacy'
import { migrateMealType } from './meals'
import { notifyPhotosChanged } from './photos'
import type {
  NutritionAssessmentSettings,
  ChildProfile,
  SlotType,
  DailyMetricEntry,
  GrowthEntry,
  Settings,
  FoodEntry,
  SymptomEntry,
  JournalData,
  MealConsistency,
  MealEntry,
  MoodEntry,
  PoopEntry,
  QuantityUnit,
  WaterEntry,
  WaterUnit,
} from './types'
import { emptyJournal } from './types'

const STORAGE_KEY = 'gut-journal-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalize(raw: unknown): JournalData {
  const data = emptyJournal()
  if (!isRecord(raw)) return data

  if (Array.isArray(raw.meals)) {
    data.meals = raw.meals.filter(isRecord).map((item) => {
      const consistency = (asString(item.consistency, 'solid') as MealConsistency)
      const percent = asNumber(item.consistencyPercent)
      return {
        id: asString(item.id, crypto.randomUUID()),
        date: asString(item.date),
        time: asString(item.time, '12:00'),
        endTime: asString(item.endTime),
        type: migrateMealType(asString(item.type, 'mini-snack')),
        foods: asString(item.foods),
        quantity: asNumber(item.quantity),
        quantityUnit: (asString(item.quantityUnit, 'spoons') as QuantityUnit),
        consistency: ['solid', 'semi-solid', 'liquid'].includes(consistency) ? consistency : 'solid',
        consistencyPercent: consistency === 'semi-solid' ? percent : null,
        calories: asNumber(item.calories),
        notes: asString(item.notes),
        hasBeforePhoto: asBoolean(item.hasBeforePhoto) || Boolean(item.photoBefore),
        hasAfterPhoto: asBoolean(item.hasAfterPhoto) || Boolean(item.photoAfter),
        source: '' as const,
        items: [],
      }
    })
  }

  if (Array.isArray(raw.poops)) {
    data.poops = raw.poops.filter(isRecord).map((item) => ({
      id: asString(item.id, crypto.randomUUID()),
      date: asString(item.date),
      time: asString(item.time, '12:00'),
      bristol: Number(item.bristol) as PoopEntry['bristol'],
      color: (asString(item.color, 'brown') as PoopEntry['color']),
      amount: (asString(item.amount, 'medium') as PoopEntry['amount']),
      straining: asBoolean(item.straining),
      pain: asBoolean(item.pain),
      mucus: asBoolean(item.mucus),
      visibleBlood: asBoolean(item.visibleBlood),
      hasPhoto: false,
      notes: asString(item.notes),
    }))
  }

  if (Array.isArray(raw.moods)) {
    data.moods = raw.moods.filter(isRecord).map((item) => ({
      id: asString(item.id, crypto.randomUUID()),
      date: asString(item.date),
      time: asString(item.time, '12:00'),
      mood: (asString(item.mood, 'calm') as MoodEntry['mood']),
      notes: asString(item.notes),
    }))
  }

  if (Array.isArray(raw.waters)) {
    data.waters = raw.waters.filter(isRecord).map((item): WaterEntry => {
      const unit = asString(item.unit, 'ml') as WaterUnit
      const amount = asNumber(item.amount) ?? 0
      return {
        id: asString(item.id, crypto.randomUUID()),
        date: asString(item.date),
        time: asString(item.time, '12:00'),
        amount,
        unit: unit === 'sips' || unit === 'cups' ? unit : 'ml',
        notes: asString(item.notes),
      }
    }).filter((item) => item.amount > 0)
  }

  if (isRecord(raw.dayNotes)) {
    for (const [date, note] of Object.entries(raw.dayNotes)) {
      if (typeof note === 'string') data.dayNotes[date] = note
    }
  }

  return data
}

export function loadJournal(): JournalData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyJournal()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyJournal()
  }
}

function isEmpty(data: JournalData) {
  return (
    data.meals.length === 0 &&
    data.poops.length === 0 &&
    data.moods.length === 0 &&
    data.waters.length === 0 &&
    !Object.values(data.dayNotes).some((note) => note.trim())
  )
}

async function loadFromServer(): Promise<JournalData> {
  let lastError: unknown
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await getJournal()
    } catch (error) {
      lastError = error
      if (error instanceof AuthError || !(error instanceof OfflineError) || attempt === 39) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

async function migrateBrowserJournal(remote: JournalData): Promise<JournalData> {
  if (!isEmpty(remote)) return remote
  const local = loadJournal()
  if (isEmpty(local)) return remote
  const meals = await attachLegacyPhotos(local.meals).catch(() => local.meals)
  const imported = await importJournal(JSON.stringify({ ...local, meals }))
  localStorage.removeItem(STORAGE_KEY)
  await clearLegacyPhotos().catch(() => undefined)
  return imported
}

/** Focus and visibility events often fire together; refetch at most this often. */
const REFRESH_MIN_INTERVAL_MS = 10_000

export function useJournal() {
  const [data, setData] = useState<JournalData>(() => emptyJournal())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const notesRef = useRef<Record<string, string>>({})
  const noteTimers = useRef(new Map<string, number>())
  const noteChain = useRef(new Map<string, Promise<void>>())
  /** Day notes whose save request is still in flight. */
  const notesSaving = useRef(new Set<string>())
  /** Bumped on every local change, so a background refresh that started earlier is discarded. */
  const localVersion = useRef(0)
  const lastFetched = useRef(0)
  const refreshing = useRef(false)

  const update = useCallback((change: (prev: JournalData) => JournalData) => {
    localVersion.current += 1
    setData(change)
  }, [])

  const remember = useCallback((next: JournalData) => {
    // Replacing the journal (load, import, delete-all, refresh) also invalidates older refreshes.
    localVersion.current += 1
    notesRef.current = next.dayNotes
    setData({ ...next, waters: next.waters ?? [], symptoms: next.symptoms ?? [], dailyMetrics: next.dailyMetrics ?? [], growth: next.growth ?? [], mealSlots: next.mealSlots ?? [], settings: { ...emptyJournal().settings, ...next.settings } })
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)
    void (async () => {
      try {
        const remote = await loadFromServer()
        const next = await migrateBrowserJournal(remote)
        if (cancelled) return
        remember(next)
        lastFetched.current = Date.now()
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) return
        setStatus('error')
        setError(loadError instanceof Error ? loadError.message : 'Could not open the journal')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt, remember])

  const persistNote = useCallback((date: string) => {
    const note = notesRef.current[date] ?? ''
    const previous = noteChain.current.get(date) ?? Promise.resolve()
    notesSaving.current.add(date)
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await setNote(date, note)
        setSaveError(null)
      })
      .catch((saveFailure: unknown) => {
        setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Could not save the day note')
      })
      .finally(() => {
        if (noteChain.current.get(date) === next) notesSaving.current.delete(date)
      })
    noteChain.current.set(date, next)
  }, [])

  /**
   * Fetch the latest journal in the background (e.g. after the app regains focus) so entries made
   * on another device appear. The screen is not cleared while it loads. Day notes still being typed
   * or saved here are kept, and a result is discarded if anything changed locally meanwhile.
   */
  const refresh = useCallback(async () => {
    if (refreshing.current || document.visibilityState !== 'visible') return
    if (Date.now() - lastFetched.current < REFRESH_MIN_INTERVAL_MS) return
    refreshing.current = true
    const version = localVersion.current
    try {
      const remote = await getJournal()
      lastFetched.current = Date.now()
      if (version !== localVersion.current) return
      const dayNotes = { ...remote.dayNotes }
      for (const date of new Set([...noteTimers.current.keys(), ...notesSaving.current])) {
        dayNotes[date] = notesRef.current[date] ?? ''
      }
      remember({ ...remote, dayNotes })
    } catch {
      // Offline or a server hiccup: keep what is on screen and try again next time.
      // A signed-out session is handled by the app-wide unauthorized event.
    } finally {
      refreshing.current = false
    }
  }, [remember])

  useEffect(() => {
    if (status !== 'ready') return
    const onFocus = () => void refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status, refresh])

  const upsertMeal = useCallback(async (entry: MealEntry) => {
    const saved = await saveMeal(entry)
    update((prev) => ({
      ...prev,
      meals: [...prev.meals.filter((item) => item.id !== saved.id), saved],
      // The server clears a "not eaten" mark when food is logged for that slot.
      mealSlots: prev.mealSlots.filter((item) => !(item.date === saved.date && item.mealType === saved.type)),
    }))
  }, [update])

  const upsertPoop = useCallback(async (entry: PoopEntry) => {
    const saved = await savePoop(entry)
    update((prev) => ({
      ...prev,
      poops: [...prev.poops.filter((item) => item.id !== saved.id), saved],
    }))
  }, [update])

  const upsertMood = useCallback(async (entry: MoodEntry) => {
    const saved = await saveMood(entry)
    update((prev) => ({
      ...prev,
      moods: [...prev.moods.filter((item) => item.id !== saved.id), saved],
    }))
  }, [update])

  const upsertWater = useCallback(async (entry: WaterEntry) => {
    const saved = await saveWater(entry)
    update((prev) => ({
      ...prev,
      waters: [...(prev.waters ?? []).filter((item) => item.id !== saved.id), saved],
    }))
  }, [update])

  const upsertSymptom = useCallback(async (entry: SymptomEntry) => {
    const saved = await saveSymptom(entry)
    update((prev) => ({
      ...prev,
      symptoms: [...prev.symptoms.filter((item) => item.id !== saved.id), saved],
    }))
  }, [update])

  const removeSymptom = useCallback(async (id: string) => {
    await deleteSymptom(id)
    update((prev) => ({ ...prev, symptoms: prev.symptoms.filter((item) => item.id !== id) }))
  }, [update])

  const saveDailyMetric = useCallback(async (entry: DailyMetricEntry) => {
    const saved = await putDailyMetric(entry)
    update((prev) => ({
      ...prev,
      dailyMetrics: [...prev.dailyMetrics.filter((item) => item.date !== saved.date), saved],
    }))
  }, [update])

  const upsertGrowth = useCallback(async (entry: GrowthEntry) => {
    const saved = await saveGrowth(entry)
    update((prev) => ({ ...prev, growth: [...prev.growth.filter((item) => item.id !== saved.id), saved] }))
  }, [update])

  const removeGrowth = useCallback(async (id: string) => {
    await deleteGrowth(id)
    update((prev) => ({ ...prev, growth: prev.growth.filter((item) => item.id !== id) }))
  }, [update])

  const deleteEverything = useCallback(async () => {
    for (const timer of noteTimers.current.values()) window.clearTimeout(timer)
    noteTimers.current.clear()
    const next = await wipeServer()
    remember(next)
    notifyPhotosChanged()
  }, [remember])

  /** Mark a scheduled slot "not eaten" (optionally replacing logged food) or clear that mark. */
  const setMealSlot = useCallback(async (date: string, mealType: SlotType, change: SlotChange) => {
    const saved = await putMealSlot(date, mealType, change)
    update((prev) => {
      const rest = prev.mealSlots.filter((item) => !(item.date === date && item.mealType === mealType))
      return {
        ...prev,
        meals: saved.removedMeals.length ? prev.meals.filter((meal) => !saved.removedMeals.includes(meal.id)) : prev.meals,
        mealSlots: saved.status === 'not-eaten' ? [...rest, { date, mealType, status: 'not-eaten', note: saved.note }] : rest,
      }
    })
    if (saved.removedMeals.length) notifyPhotosChanged()
  }, [update])

  const saveAssessment = useCallback(async (value: NutritionAssessmentSettings) => {
    const saved = await putSetting('nutrition-assessment', value)
    update((prev) => ({ ...prev, settings: { ...prev.settings, nutritionAssessment: saved } }))
  }, [update])

  const saveChildProfile = useCallback(async (profile: ChildProfile) => {
    const saved = await putSetting('child-profile', profile)
    update((prev) => ({ ...prev, settings: { ...prev.settings, childProfile: saved } }))
  }, [update])

  const saveReferences = useCallback(async (references: Settings['nutrientReferences']) => {
    const saved = await putSetting('nutrient-references', references)
    update((prev) => ({ ...prev, settings: { ...prev.settings, nutrientReferences: saved } }))
  }, [update])

  const upsertFood = useCallback(async (entry: FoodEntry) => {
    const saved = await saveFood(entry)
    update((prev) => ({
      ...prev,
      foods: [...prev.foods.filter((item) => item.id !== saved.id), saved],
    }))
    return saved
  }, [update])

  const removeFood = useCallback(async (id: string) => {
    await deleteFood(id)
    update((prev) => ({
      ...prev,
      foods: prev.foods.filter((item) => item.id !== id),
      // The server clears the food link on past meals and keeps the name.
      meals: prev.meals.map((meal) => ({
        ...meal,
        items: meal.items.map((item) => ({
          ...item,
          foodId: item.foodId === id ? null : item.foodId,
          ingredients: item.ingredients.map((child) => ({ ...child, foodId: child.foodId === id ? null : child.foodId })),
        })),
      })),
    }))
  }, [update])

  const removeMeal = useCallback(async (id: string) => {
    await deleteMeal(id)
    update((prev) => ({ ...prev, meals: prev.meals.filter((item) => item.id !== id) }))
    notifyPhotosChanged()
  }, [update])

  const removePoop = useCallback(async (id: string) => {
    await deletePoop(id)
    update((prev) => ({ ...prev, poops: prev.poops.filter((item) => item.id !== id) }))
  }, [update])

  const removeMood = useCallback(async (id: string) => {
    await deleteMood(id)
    update((prev) => ({ ...prev, moods: prev.moods.filter((item) => item.id !== id) }))
  }, [update])

  const removeWater = useCallback(async (id: string) => {
    await deleteWater(id)
    update((prev) => ({ ...prev, waters: (prev.waters ?? []).filter((item) => item.id !== id) }))
  }, [update])

  const setDayNote = useCallback((date: string, note: string) => {
    notesRef.current = { ...notesRef.current, [date]: note }
    update((prev) => ({
      ...prev,
      dayNotes: { ...prev.dayNotes, [date]: note },
    }))
    const existing = noteTimers.current.get(date)
    if (existing) window.clearTimeout(existing)
    noteTimers.current.set(
      date,
      window.setTimeout(() => {
        noteTimers.current.delete(date)
        persistNote(date)
      }, 300),
    )
  }, [persistNote, update])

  const flushDayNote = useCallback((date: string) => {
    const existing = noteTimers.current.get(date)
    if (!existing) return
    window.clearTimeout(existing)
    noteTimers.current.delete(date)
    persistNote(date)
  }, [persistNote])

  const importBackup = useCallback(async (text: string) => {
    const next = await importJournal(text)
    remember(next)
    notifyPhotosChanged()
  }, [remember])

  const exportBackup = useCallback(async () => {
    for (const [date, timer] of noteTimers.current) {
      window.clearTimeout(timer)
      noteTimers.current.delete(date)
      persistNote(date)
    }
    await Promise.all([...noteChain.current.values()])
    await downloadExport()
  }, [persistNote])

  return {
    data,
    status,
    error,
    saveError,
    reload: () => setAttempt((value) => value + 1),
    upsertMeal,
    upsertPoop,
    upsertMood,
    upsertWater,
    upsertFood,
    removeFood,
    upsertSymptom,
    removeSymptom,
    saveDailyMetric,
    upsertGrowth,
    removeGrowth,
    setMealSlot,
    saveAssessment,
    deleteEverything,
    saveChildProfile,
    saveReferences,
    removeMeal,
    removePoop,
    removeMood,
    removeWater,
    setDayNote,
    flushDayNote,
    importBackup,
    exportBackup,
  }
}

export function parseImportedJournal(text: string): JournalData {
  return normalize(JSON.parse(text))
}
