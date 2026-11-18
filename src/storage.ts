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
  putSetting,
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
  ChildProfile,
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

export function useJournal() {
  const [data, setData] = useState<JournalData>(() => emptyJournal())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const notesRef = useRef<Record<string, string>>({})
  const noteTimers = useRef(new Map<string, number>())
  const noteChain = useRef(new Map<string, Promise<void>>())

  const remember = useCallback((next: JournalData) => {
    notesRef.current = next.dayNotes
    setData({ ...next, waters: next.waters ?? [], symptoms: next.symptoms ?? [], dailyMetrics: next.dailyMetrics ?? [], growth: next.growth ?? [], settings: next.settings ?? emptyJournal().settings })
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
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await setNote(date, note)
        setSaveError(null)
      })
      .catch((saveFailure: unknown) => {
        setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Could not save the day note')
      })
    noteChain.current.set(date, next)
  }, [])

  const upsertMeal = useCallback(async (entry: MealEntry) => {
    const saved = await saveMeal(entry)
    setData((prev) => ({
      ...prev,
      meals: [...prev.meals.filter((item) => item.id !== saved.id), saved],
    }))
  }, [])

  const upsertPoop = useCallback(async (entry: PoopEntry) => {
    const saved = await savePoop(entry)
    setData((prev) => ({
      ...prev,
      poops: [...prev.poops.filter((item) => item.id !== saved.id), saved],
    }))
  }, [])

  const upsertMood = useCallback(async (entry: MoodEntry) => {
    const saved = await saveMood(entry)
    setData((prev) => ({
      ...prev,
      moods: [...prev.moods.filter((item) => item.id !== saved.id), saved],
    }))
  }, [])

  const upsertWater = useCallback(async (entry: WaterEntry) => {
    const saved = await saveWater(entry)
    setData((prev) => ({
      ...prev,
      waters: [...(prev.waters ?? []).filter((item) => item.id !== saved.id), saved],
    }))
  }, [])

  const upsertSymptom = useCallback(async (entry: SymptomEntry) => {
    const saved = await saveSymptom(entry)
    setData((prev) => ({
      ...prev,
      symptoms: [...prev.symptoms.filter((item) => item.id !== saved.id), saved],
    }))
  }, [])

  const removeSymptom = useCallback(async (id: string) => {
    await deleteSymptom(id)
    setData((prev) => ({ ...prev, symptoms: prev.symptoms.filter((item) => item.id !== id) }))
  }, [])

  const saveDailyMetric = useCallback(async (entry: DailyMetricEntry) => {
    const saved = await putDailyMetric(entry)
    setData((prev) => ({
      ...prev,
      dailyMetrics: [...prev.dailyMetrics.filter((item) => item.date !== saved.date), saved],
    }))
  }, [])

  const upsertGrowth = useCallback(async (entry: GrowthEntry) => {
    const saved = await saveGrowth(entry)
    setData((prev) => ({ ...prev, growth: [...prev.growth.filter((item) => item.id !== saved.id), saved] }))
  }, [])

  const removeGrowth = useCallback(async (id: string) => {
    await deleteGrowth(id)
    setData((prev) => ({ ...prev, growth: prev.growth.filter((item) => item.id !== id) }))
  }, [])

  const deleteEverything = useCallback(async () => {
    for (const timer of noteTimers.current.values()) window.clearTimeout(timer)
    noteTimers.current.clear()
    const next = await wipeServer()
    remember(next)
    notifyPhotosChanged()
  }, [remember])

  const saveChildProfile = useCallback(async (profile: ChildProfile) => {
    const saved = await putSetting('child-profile', profile)
    setData((prev) => ({ ...prev, settings: { ...prev.settings, childProfile: saved } }))
  }, [])

  const saveReferences = useCallback(async (references: Settings['nutrientReferences']) => {
    const saved = await putSetting('nutrient-references', references)
    setData((prev) => ({ ...prev, settings: { ...prev.settings, nutrientReferences: saved } }))
  }, [])

  const upsertFood = useCallback(async (entry: FoodEntry) => {
    const saved = await saveFood(entry)
    setData((prev) => ({
      ...prev,
      foods: [...prev.foods.filter((item) => item.id !== saved.id), saved],
    }))
    return saved
  }, [])

  const removeFood = useCallback(async (id: string) => {
    await deleteFood(id)
    setData((prev) => ({
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
  }, [])

  const removeMeal = useCallback(async (id: string) => {
    await deleteMeal(id)
    setData((prev) => ({ ...prev, meals: prev.meals.filter((item) => item.id !== id) }))
    notifyPhotosChanged()
  }, [])

  const removePoop = useCallback(async (id: string) => {
    await deletePoop(id)
    setData((prev) => ({ ...prev, poops: prev.poops.filter((item) => item.id !== id) }))
  }, [])

  const removeMood = useCallback(async (id: string) => {
    await deleteMood(id)
    setData((prev) => ({ ...prev, moods: prev.moods.filter((item) => item.id !== id) }))
  }, [])

  const removeWater = useCallback(async (id: string) => {
    await deleteWater(id)
    setData((prev) => ({ ...prev, waters: (prev.waters ?? []).filter((item) => item.id !== id) }))
  }, [])

  const setDayNote = useCallback((date: string, note: string) => {
    notesRef.current = { ...notesRef.current, [date]: note }
    setData((prev) => ({
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
  }, [persistNote])

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
