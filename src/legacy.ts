import { blobToDataUrl } from './photos'
import type { MealEntry } from './types'

const DB_NAME = 'gut-journal-photos'
const DB_VERSION = 1
const STORE = 'photos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function legacyPhoto(mealId: string, slot: 'before' | 'after'): Promise<Blob | null> {
  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(`${mealId}:${slot}`)
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return blob
}

export async function attachLegacyPhotos(meals: MealEntry[]) {
  return Promise.all(
    meals.map(async (meal) => {
      const extra: { photoBefore?: string; photoAfter?: string } = {}
      if (meal.hasBeforePhoto) {
        const blob = await legacyPhoto(meal.id, 'before').catch(() => null)
        if (blob) extra.photoBefore = await blobToDataUrl(blob)
      }
      if (meal.hasAfterPhoto) {
        const blob = await legacyPhoto(meal.id, 'after').catch(() => null)
        if (blob) extra.photoAfter = await blobToDataUrl(blob)
      }
      return { ...meal, ...extra }
    }),
  )
}

export async function clearLegacyPhotos() {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
