import type { JournalData, MealEntry, MoodEntry, PoopEntry } from './types'

type PhotoSlot = 'before' | 'after'

export class OfflineError extends Error {
  constructor() {
    super('The journal server is not running. Start it with npm run dev.')
    this.name = 'OfflineError'
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(path, { ...init, cache: 'no-store' })
  } catch {
    throw new OfflineError()
  }
  if (response.ok) return response
  if (response.status === 503) throw new OfflineError()
  let message = 'Could not save to the journal'
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string' && body.error) message = body.error
  } catch {
    message = response.statusText || message
  }
  throw new Error(message)
}

async function sendJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init)
  return (await response.json()) as T
}

function putJson(body: unknown): RequestInit {
  return {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function getJournal() {
  return sendJson<JournalData>('/api/journal')
}

export function upsertMeal(entry: MealEntry) {
  return sendJson<MealEntry>('/api/meals', putJson(entry))
}

export function upsertPoop(entry: PoopEntry) {
  return sendJson<PoopEntry>('/api/poops', putJson(entry))
}

export function upsertMood(entry: MoodEntry) {
  return sendJson<MoodEntry>('/api/moods', putJson(entry))
}

export async function deleteMeal(id: string) {
  await send(`/api/meals/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deletePoop(id: string) {
  await send(`/api/poops/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deleteMood(id: string) {
  await send(`/api/moods/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function setNote(date: string, note: string) {
  await send(`/api/notes/${encodeURIComponent(date)}`, putJson({ note }))
}

export async function putPhoto(mealId: string, slot: PhotoSlot, blob: Blob) {
  await send(`/api/photos/${encodeURIComponent(mealId)}/${slot}`, {
    method: 'PUT',
    headers: { 'content-type': blob.type || 'image/jpeg' },
    body: blob,
  })
}

export async function fetchPhoto(mealId: string, slot: PhotoSlot): Promise<Blob | null> {
  let response: Response
  try {
    response = await fetch(`/api/photos/${encodeURIComponent(mealId)}/${slot}`, { cache: 'no-store' })
  } catch {
    throw new OfflineError()
  }
  if (response.status === 404) return null
  if (response.status === 503) throw new OfflineError()
  if (!response.ok) throw new Error('Could not load that photo')
  return response.blob()
}

export async function deletePhoto(mealId: string, slot: PhotoSlot) {
  const response = await fetch(`/api/photos/${encodeURIComponent(mealId)}/${slot}`, {
    method: 'DELETE',
    cache: 'no-store',
  })
  if (response.status === 404) return
  if (response.ok) return
  if (response.status === 503) throw new OfflineError()
  throw new Error('Could not delete that photo')
}

export async function importJournal(text: string) {
  return sendJson<JournalData>('/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: text,
  })
}

export async function downloadExport() {
  const response = await send('/api/export')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ashrit-gut-journal-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
